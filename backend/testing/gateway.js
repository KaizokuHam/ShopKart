import crypto from "node:crypto";
import razorpay from "../config/razorpay.js";

export function testGateway() {
  process.env.RAZORPAY_KEY_ID = "rzp_test_isolated";
  process.env.RAZORPAY_KEY_SECRET = "isolated-test-provider-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "isolated-test-webhook-secret";
  const payments = new Map();
  const orders = new Map();
  razorpay.orders.create = async data => {
    const order = { ...data, id: "order_" + crypto.randomUUID().replaceAll("-", "") };
    orders.set(order.id, order);
    return order;
  };
  razorpay.payments.fetch = async id => {
    if (!payments.has(id)) throw new Error("Test payment not found");
    return payments.get(id);
  };
  razorpay.orders.fetchPayments = async id => ({ items: [...payments.values()].filter(payment => payment.order_id === id) });
  return {
    payment(orderId, status = "captured") {
      const order = orders.get(orderId);
      if (!order) throw new Error("Test gateway order not found");
      const payment = { id: "pay_" + crypto.randomUUID().replaceAll("-", ""), order_id: orderId, amount: order.amount, currency: "INR", status };
      payments.set(payment.id, payment);
      return { ...payment, signature: crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(orderId + "|" + payment.id).digest("hex") };
    },
    payments,
  };
}
