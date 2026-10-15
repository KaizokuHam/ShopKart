import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Customer from "../models/customer.model.js";

export const paymentError = (message, status = 400) => Object.assign(new Error(message), { status });

export function assertPaymentMatches(order, payment) {
  if (!payment || typeof payment.id !== "string" || payment.order_id !== order.razorpayOrderId ||
      payment.currency !== "INR" || payment.amount !== Math.round(order.totalAmount * 100)) {
    throw paymentError("Payment does not match this order");
  }
}

// Subtract only the purchased quantities. Preserve other products and items
// removed/re-added with a new cart line ID while Checkout was open.
export function purchasedCartUpdate(items) {
  const purchases = items.map(item => ({ product: item.product, cartItemId: item.cartItemId || null, quantity: item.quantity }));
  return [{ $set: {
    cart: { $filter: {
      input: { $map: { input: { $ifNull: ["$cart", []] }, as: "line", in: {
        $let: {
          vars: { purchase: { $arrayElemAt: [{ $filter: { input: { $literal: purchases }, as: "purchased", cond: { $and: [
            { $eq: ["$$purchased.product", "$$line.product"] },
            { $or: [{ $eq: ["$$purchased.cartItemId", null] }, { $eq: ["$$purchased.cartItemId", "$$line._id"] }] },
          ] } } }, 0] } },
          in: { $mergeObjects: ["$$line", { quantity: { $max: [0, { $subtract: ["$$line.quantity", { $ifNull: ["$$purchase.quantity", 0] }] }] } }] },
        },
      } } }, as: "remaining", cond: { $gt: ["$$remaining.quantity", 0] },
    } },
    __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
  } }];
}

export async function settleCapturedPayment(order, payment, { retryReview = false } = {}) {
  assertPaymentMatches(order, payment);
  if (payment.status !== "captured") throw paymentError("Payment has not been captured", 409);
  let confirmed;
  try {
    await mongoose.connection.transaction(async session => {
      confirmed = await Order.findById(order._id).session(session);
      if (!confirmed) throw paymentError("Order not found", 404);
      if (confirmed.paymentStatus === "PAID") {
        if (confirmed.razorpayPaymentId !== payment.id) throw paymentError("Order already paid with another payment", 409);
        if (!retryReview || confirmed.status !== "PAYMENT_REVIEW") return;
      }
      for (const item of confirmed.items) {
        const result = await Product.updateOne({ _id: item.product, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
        if (result.modifiedCount !== 1) throw Object.assign(paymentError("Payment received, but stock is no longer available. Your order needs store assistance; do not pay again.", 409), { stockConflict: true });
      }
      confirmed.paymentStatus = "PAID";
      confirmed.status = "PLACED";
      confirmed.razorpayPaymentId = payment.id;
      confirmed.paymentAttemptStatus = "SUCCEEDED";
      confirmed.lastPaymentError = undefined;
      confirmed.activeCheckoutKey = undefined;
      await confirmed.save({ session });
      const customer = await Customer.updateOne({ _id: confirmed.user }, purchasedCartUpdate(confirmed.items), { session, updatePipeline: true });
      if (customer.matchedCount !== 1) throw paymentError("Customer no longer exists", 409);
    });
  } catch (error) {
    if (!error.stockConflict) throw error;
    // A captured charge must never be presented as unpaid or retriable checkout.
    confirmed = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $ne: "PAID" } }, { $set: {
      paymentStatus: "PAID", status: "PAYMENT_REVIEW", razorpayPaymentId: payment.id,
      paymentAttemptStatus: "SUCCEEDED", lastPaymentError: error.message,
    }, $unset: { activeCheckoutKey: "" } }, { returnDocument: "after" }) || await Order.findById(order._id);
  }
  return confirmed;
}
