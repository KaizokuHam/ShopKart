import crypto from "crypto";
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import razorpay, { paymentConfigured } from "../config/razorpay.js";
import { settleCapturedPayment } from "../services/payment.service.js";
import { isAdminEmail } from "../middleware/admin.middleware.js";

const checkoutResponse = (res, order, amount) => res.json({ success: true, message: "Order created. Proceed to payment.",
  shopKartOrderId: order._id, razorpayOrderId: order.razorpayOrderId, amount, currency: "INR", key: process.env.RAZORPAY_KEY_ID, order });

async function resumeCheckout(res, order, shippingAddress) {
  if (!order) return res.status(409).json({ success: false, message: "Checkout is being prepared. Try again shortly." });
  if (!order.razorpayOrderId) {
    if (order.createdAt && Date.now() - new Date(order.createdAt).getTime() > 120000) {
      await Order.updateOne({ _id: order._id, razorpayOrderId: { $exists: false } }, { $unset: { activeCheckoutKey: "" }, $set: { paymentStatus: "FAILED" } });
    }
    return res.status(409).json({ success: false, orderId: order._id, message: "This checkout is being prepared or interrupted. Try again shortly." });
  }
  let payments;
  try { payments = await razorpay.orders.fetchPayments(order.razorpayOrderId); }
  catch { return res.status(502).json({ success: false, orderId: order._id, message: "We could not check your previous payment. Open that order and check its status before paying again." }); }
  if (!Array.isArray(payments.items)) throw new Error("Unable to establish the previous payment result");
  const captured = payments.items?.find(payment => payment.status === "captured");
  if (captured) {
    await settleCapturedPayment(order, captured);
    return res.status(409).json({ success: false, orderId: order._id, message: "Your previous payment was received. Open the order; do not pay again." });
  }
  if (payments.items?.some(payment => ["authorized", "created"].includes(payment.status))) {
    return res.status(409).json({ success: false, orderId: order._id, message: "Your existing payment is processing. Check that order; do not pay again." });
  }
  if (payments.items.some(payment => payment.status === "refunded")) {
    await Order.updateOne({ _id: order._id, paymentStatus: { $ne: "PAID" } }, { $unset: { activeCheckoutKey: "" } });
    return res.status(409).json({ success: false, orderId: order._id, message: "The previous payment was refunded. Check the order and retry checkout." });
  }
  const resumed = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $ne: "PAID" } }, {
    $set: { shippingAddress, paymentStatus: "PENDING", paymentAttemptStatus: "OPEN" }, $unset: { lastPaymentError: "" },
  }, { returnDocument: "after" });
  if (!resumed) return res.status(409).json({ success: false, orderId: order._id, message: "This payment was already confirmed. Open the order instead of paying again." });
  return checkoutResponse(res, resumed, Math.round(resumed.totalAmount * 100));
}

/**
 * Task 4: Create Pending ShopKart Order + Razorpay Order
 * POST /orders/create-payment-order
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const { shippingAddress } = req.body || {};

    // 1. Validate shipping address fields
    if (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    const { fullName, phone, addressLine1, city, state, pincode } = shippingAddress;

    if (
      typeof fullName !== "string" || !fullName.trim() ||
      typeof phone !== "string" || !phone.trim() ||
      typeof addressLine1 !== "string" || !addressLine1.trim() ||
      typeof city !== "string" || !city.trim() ||
      typeof state !== "string" || !state.trim() ||
      typeof pincode !== "string" || !pincode.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "All shipping address fields are required",
      });
    }

    // Phone validation (10 to 12 digits)
    const phoneRegex = /^[0-9]{10,12}$/;
    const cleanPhone = phone.trim().replace(/[\s-]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be valid (10 to 12 digits)",
      });
    }

    // Pincode validation (6 digits)
    const pincodeRegex = /^[0-9]{6}$/;
    if (!pincodeRegex.test(pincode.trim())) {
      return res.status(400).json({
        success: false,
        message: "Pincode must contain 6 digits",
      });
    }

    if (!paymentConfigured()) {
      return res.status(503).json({ success: false, message: "Checkout requires configured Razorpay Test Mode credentials." });
    }
    const needsReview = await Order.findOne({ user: req.user._id, status: "PAYMENT_REVIEW" });
    if (needsReview) return res.status(409).json({ success: false, orderId: needsReview._id, message: "A received payment needs store assistance. Open that order before starting another payment." });

    // 2. Load authenticated user and cart
    const user = await Customer.findById(req.user._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Cannot checkout an empty cart.",
      });
    }

    // 3. Load latest product data & perform final stock verification
    const orderItems = [];
    for (const item of user.cart) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "One or more products in your cart are no longer available.",
        });
      }

      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Only ${product.stock} units available.`,
        });
      }

      // Build purchase-time snapshot
      orderItems.push({
        product: product._id,
        cartItemId: item._id,
        name: product.name,
        price: Math.round(product.price * 100) / 100,
        quantity: item.quantity,
        image: product.image,
      });
    }

    // 4. Calculate total amount strictly on server (ignore any client-side total)
    const amountInPaise = orderItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ success: false, message: "Order total must be at least ₹1 and within the supported amount." });
    }
    const totalAmount = amountInPaise / 100;
    const delivery = { fullName: fullName.trim(), phone: cleanPhone, addressLine1: addressLine1.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim() };
    const activeCheckoutKey = crypto.createHash("sha256").update(JSON.stringify({ user: req.user._id.toString(), items: orderItems.map(item => ({
      line: item.cartItemId?.toString(), product: item.product.toString(), quantity: item.quantity, price: item.price,
    })).sort((a, b) => a.product.localeCompare(b.product)) })).digest("hex");
    const existing = await Order.findOne({ activeCheckoutKey });
    if (existing) return await resumeCheckout(res, existing, delivery);

    // 5. Create pending ShopKart order in MongoDB
    let shopKartOrder;
    try { shopKartOrder = await Order.create({
      activeCheckoutKey,
      user: req.user._id,
      items: orderItems,
      shippingAddress: delivery,
      totalAmount,
      paymentStatus: "PENDING",
      status: "PENDING_PAYMENT",
    }); } catch (error) {
      if (error.code === 11000) return await resumeCheckout(res, await Order.findOne({ activeCheckoutKey }), delivery);
      throw error;
    }

    // 6. Create Razorpay order (amount converted to paise)
    let razorpayOrderId = "";

    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: shopKartOrder._id.toString(),
      });
      razorpayOrderId = rzpOrder.id;
    } catch (rzpErr) {
      shopKartOrder.paymentStatus = "FAILED";
      shopKartOrder.activeCheckoutKey = undefined;
      await shopKartOrder.save();
      console.error("Razorpay order creation failed:", rzpErr.message);
      return res.status(502).json({ success: false, message: "Payment provider unavailable. Your cart has been preserved. Please try again." });
    }

    shopKartOrder.razorpayOrderId = razorpayOrderId;
    await shopKartOrder.save();

    return checkoutResponse(res, shopKartOrder, amountInPaise);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create payment order. Please try again.",
      error: error.message,
    });
  }
};

/**
 * Task 4 & 5: Verify Razorpay Signature, Confirm Order, Clear Cart
 * POST /orders/verify-payment
 */
export const verifyPayment = async (req, res) => {
  try {
    const {
      shopKartOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    if (typeof shopKartOrderId !== "string" || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(shopKartOrderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // 1. Find ShopKart order and verify ownership
    const order = await Order.findById(shopKartOrderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden: You do not own this order",
      });
    }

    if (!paymentConfigured()) {
      return res.status(503).json({ success: false, message: "Payment verification is not configured." });
    }
    if (!order.razorpayOrderId || razorpay_order_id !== order.razorpayOrderId ||
        typeof razorpay_payment_id !== "string" || typeof razorpay_signature !== "string" ||
        !/^[a-f0-9]{64}$/i.test(razorpay_signature)) {
      return res.status(400).json({ success: false, message: "Invalid payment verification parameters" });
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order.razorpayOrderId + "|" + razorpay_payment_id).digest();
    if (!crypto.timingSafeEqual(expected, Buffer.from(razorpay_signature, "hex"))) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    if (order.paymentStatus === "PAID") {
      if (order.razorpayPaymentId !== razorpay_payment_id) {
        return res.status(409).json({ success: false, message: "Order already paid with another payment" });
      }
      return res.json({ success: true, order });
    }
    // A valid signature proves authenticity; capture proves payment completion.
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch {
      return res.status(502).json({ success: false, retryVerification: true, message: "Unable to confirm the payment with Razorpay. Retry confirmation; do not pay again." });
    }
    if (payment.order_id !== order.razorpayOrderId || payment.currency !== "INR" ||
        payment.amount !== Math.round(order.totalAmount * 100)) {
      return res.status(400).json({ success: false, message: "Payment does not match this order" });
    }
    if (payment.status === "failed" || payment.status === "refunded") {
      await Order.updateOne({ _id: order._id, paymentStatus: { $ne: "PAID" } }, {
        $set: { paymentStatus: "FAILED", paymentAttemptStatus: "FAILED", lastPaymentError: "Payment was not completed" },
      });
      return res.status(400).json({ success: false, paymentFailed: true, message: "Payment was not completed. Your cart is unchanged. You can try again." });
    }
    if (payment.status !== "captured") {
      await Order.updateOne({ _id: order._id, paymentStatus: { $ne: "PAID" } }, {
        $set: { paymentAttemptStatus: "VERIFYING", razorpayPaymentId: razorpay_payment_id },
      });
      return res.status(202).json({ success: false, retryVerification: true, message: "Payment is still processing. Retry confirmation shortly; do not pay again." });
    }

    const confirmedOrder = await settleCapturedPayment(order, { ...payment, id: razorpay_payment_id });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully. Order confirmed!",
      order: confirmedOrder,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Payment verification failed. Please try again.",
      error: error.message,
    });
  }
};

// Record an unsuccessful checkout attempt without changing inventory or cart.
export const reportPaymentResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, paymentId } = req.body || {};
    if (!mongoose.isObjectIdOrHexString(id) || !["FAILED", "CANCELLED"].includes(outcome) ||
        (paymentId !== undefined && typeof paymentId !== "string")) {
      return res.status(400).json({ success: false, message: "Invalid payment result" });
    }
    const order = await Order.findById(id);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentStatus === "PAID") return res.json({ success: true, order });
    if (paymentId) {
      if (!paymentConfigured()) return res.status(503).json({ success: false, message: "Payment verification is not configured" });
      const payment = await razorpay.payments.fetch(paymentId);
      if (payment.order_id !== order.razorpayOrderId) return res.status(400).json({ success: false, message: "Payment does not match this order" });
      if (payment.status !== "failed") return res.status(202).json({ success: false, message: "Payment may still be processing. Check confirmation before paying again." });
    }
    const changes = {
      paymentAttemptStatus: outcome,
      lastPaymentError: outcome === "FAILED" ? "Payment attempt failed. Your cart has been preserved." : "Checkout cancelled. Your cart has been preserved.",
    };
    if (outcome === "FAILED") changes.paymentStatus = "FAILED";
    const updated = await Order.findOneAndUpdate(
      { _id: id, user: req.user._id, paymentStatus: { $ne: "PAID" } },
      { $set: changes }, { returnDocument: "after" });
    return res.json({ success: true, order: updated || await Order.findById(id) });
  } catch {
    return res.status(502).json({ success: false, message: "Unable to record payment result. Your cart is unchanged." });
  }
};

/**
 * Task 7: Get all orders for current authenticated user
 * GET /orders
 */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve orders.",
      error: error.message,
    });
  }
};

/**
 * Single Order API: Get details of one order
 * GET /orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Customers see their own orders; trusted store operators can provide support.
    if (order.user.toString() !== req.user._id.toString() && !isAdminEmail(req.user.email)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not own this order",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order.",
      error: error.message,
    });
  }
};

/**
 * Bonus Challenge: Progress Order Status
 * PATCH /orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ success: false, message: "Invalid order ID" });

    const validStatuses = [
      "PENDING_PAYMENT",
      "PLACED",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!isAdminEmail(req.user.email)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const transitions = { PLACED: "CONFIRMED", CONFIRMED: "SHIPPED", SHIPPED: "DELIVERED" };
    if (order.paymentStatus !== "PAID" || transitions[order.status] !== status) {
      return res.status(400).json({ success: false, message: "Only paid orders can advance to the next fulfilment stage" });
    }
    const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status, paymentStatus: "PAID" }, { $set: { status } }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ success: false, message: "Order status changed. Refresh before updating it." });

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to update status",
      error: error.message,
    });
  }
};
