import crypto from "node:crypto";
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import razorpay, { paymentConfigured } from "../config/razorpay.js";
import { assertPaymentMatches, settleCapturedPayment } from "../services/payment.service.js";

export async function reconcileOrder(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order ID" });
    let order = await Order.findById(req.params.id);
    if (!order || order.user.toString() !== req.user._id.toString()) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.paymentStatus === "PAID") return res.json({ success: true, order });
    if (!order.razorpayOrderId) return res.json({ success: true, order, message: "Checkout was not opened for this order." });
    if (!paymentConfigured()) return res.status(503).json({ success: false, message: "Payment verification is not configured" });
    const result = await razorpay.orders.fetchPayments(order.razorpayOrderId);
    if (!Array.isArray(result.items)) throw new Error("Invalid provider response");
    const captured = result.items.find(payment => payment.status === "captured");
    if (captured) {
      order = await settleCapturedPayment(order, captured);
      return res.json({ success: true, order });
    }
    const processing = result.items.some(payment => ["authorized", "created"].includes(payment.status));
    if (processing) return res.status(202).json({ success: false, order, message: "Payment is still processing. Check again shortly; do not pay again." });
    if (result.items.length && result.items.every(payment => payment.status === "failed")) {
      order = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $ne: "PAID" } }, { $set: {
        paymentStatus: "FAILED", paymentAttemptStatus: "FAILED", lastPaymentError: "The payment provider confirmed that the payment failed.",
      } }, { returnDocument: "after" }) || await Order.findById(order._id);
    }
    return res.json({ success: true, order, message: result.items.length ? "Payment result checked." : "No payment has been recorded for this order." });
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : "Unable to check payment with the provider. Do not pay again until confirmation is resolved." });
  }
}

export async function paymentWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !paymentConfigured()) return res.status(503).json({ success: false, message: "Webhook is not configured" });
  const signature = req.get("x-razorpay-signature");
  if (!Buffer.isBuffer(req.body) || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }
  const expected = crypto.createHmac("sha256", secret).update(req.body).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))) return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  try {
    const event = JSON.parse(req.body.toString("utf8"));
    if (!["payment.captured", "order.paid", "payment.failed"].includes(event.event)) return res.json({ success: true, ignored: true });
    const entity = event.payload?.payment?.entity;
    if (!entity?.id || !entity.order_id) return res.status(400).json({ success: false, message: "Missing payment entity" });
    const order = await Order.findOne({ razorpayOrderId: entity.order_id });
    if (!order) return res.json({ success: true, ignored: true });
    const payment = await razorpay.payments.fetch(entity.id);
    assertPaymentMatches(order, payment);
    if (payment.status === "captured") await settleCapturedPayment(order, payment);
    else if (payment.status === "failed") await Order.updateOne({ _id: order._id, paymentStatus: { $ne: "PAID" } }, { $set: {
      paymentStatus: "FAILED", paymentAttemptStatus: "FAILED", lastPaymentError: "The payment provider confirmed that the payment failed.",
    } });
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return res.status(400).json({ success: false, message: "Invalid webhook JSON" });
    return res.status(error.status || 503).json({ success: false, message: "Unable to apply payment event; delivery may be retried" });
  }
}

export async function retryFulfillment(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: "Invalid order ID" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status !== "PAYMENT_REVIEW" || order.paymentStatus !== "PAID" || !order.razorpayPaymentId) return res.status(409).json({ success: false, message: "Only a paid order awaiting stock review can retry fulfilment" });
    const payment = await razorpay.payments.fetch(order.razorpayPaymentId);
    const updated = await settleCapturedPayment(order, payment, { retryReview: true });
    return res.json({ success: true, order: updated, message: updated.status === "PAYMENT_REVIEW" ? updated.lastPaymentError : "Stock allocated. Order placed without another charge." });
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.status ? error.message : "Unable to retry fulfilment. No new payment has been taken." });
  }
}
