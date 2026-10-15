import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../app.js";
import { testDatabase } from "../testing/database.js";
import { testGateway } from "../testing/gateway.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

let stopDatabase, server, base, gateway, cookie, product, secondProduct;
const address = { fullName: "Integration Buyer", phone: "9876543210", addressLine1: "12 Test Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
async function api(path, method = "GET", body, session = cookie) {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
before(async () => {
  process.env.jwt_secret = "isolated-database-test-jwt-secret-at-least-32";
  process.env.ADMIN_EMAILS = "";
  process.env.NODE_ENV = "test";
  stopDatabase = await testDatabase();
  gateway = testGateway();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  product = await Product.create({ name: "Integration Lamp", description: "Test fixture", price: 100.25, category: "Home", image: "https://example.com/lamp.jpg", stock: 30 });
  secondProduct = await Product.create({ name: "Integration Book", description: "Test fixture", price: 50, category: "Books", image: "https://example.com/book.jpg", stock: 30 });
  assert.equal((await api("/users/register", "POST", { ...address, email: "buyer@example.test", password: "test-password" })).status, 201);
  const login = await api("/users/login", "POST", { email: "buyer@example.test", password: "test-password" });
  cookie = login.cookie;
}, { timeout: 1200000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (stopDatabase) await stopDatabase();
});

const checkout = async () => {
  const created = await api("/orders/create-payment-order", "POST", { shippingAddress: address });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return created.body;
};
const proof = (order, payment) => ({ shopKartOrderId: order.shopKartOrderId, razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id, razorpay_signature: payment.signature });

test("account session, duplicate signup, and private routes work against a real database", async () => {
  const me = await api("/users/me");
  assert.equal(me.status, 200); assert.equal(me.body.authenticatedUser.password, undefined);
  const duplicate = await api("/users/register", "POST", { ...address, email: "BUYER@example.test", password: "test-password" });
  assert.equal(duplicate.status, 409);
  assert.equal((await api("/orders", "GET", undefined, "")).status, 401);
  assert.equal((await api("/health")).status, 200);
});
test("parallel wishlist toggles and cart writes preserve both resources", async () => {
  const results = await Promise.all([
    api(`/wishlist/${product.id}/toggle`, "PATCH"), api(`/wishlist/${product.id}/toggle`, "PATCH"), api(`/cart/${product.id}`, "POST"), api(`/cart/${product.id}`, "POST"),
  ]);
  assert.ok(results.every(result => result.status === 200));
  assert.equal((await api("/wishlist")).body.count, 0);
  const cart = (await api("/cart")).body.cart;
  assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 2);
});
test("concurrent checkout creation reuses one gateway order for the same bag", async () => {
  const attempts = await Promise.all([api("/orders/create-payment-order", "POST", { shippingAddress: address }), api("/orders/create-payment-order", "POST", { shippingAddress: address })]);
  assert.ok(attempts.every(result => [200, 409].includes(result.status)));
  const successful = attempts.filter(result => result.status === 200);
  assert.ok(successful.length);
  const resumed = await checkout();
  assert.equal(resumed.razorpayOrderId, successful[0].body.razorpayOrderId);
  assert.equal(await Order.countDocuments(), 1);
});
test("captured payment commits once and preserves products added during Checkout", async () => {
  const order = await checkout();
  assert.equal(order.amount, 20050);
  await api(`/cart/${secondProduct.id}`, "POST");
  await api(`/cart/${product.id}`, "POST");
  const payment = gateway.payment(order.razorpayOrderId);
  const results = await Promise.all([api("/orders/verify-payment", "POST", proof(order, payment)), api("/orders/verify-payment", "POST", proof(order, payment))]);
  assert.ok(results.every(result => result.status === 200));
  assert.equal((await Product.findById(product.id)).stock, 28);
  const cart = (await api("/cart")).body.cart;
  assert.equal(cart.length, 2);
  assert.equal(cart.find(line => line.product._id === product.id).quantity, 1);
  assert.equal(cart.find(line => line.product._id === secondProduct.id).quantity, 1);
});
test("re-added cart lines survive old-order confirmation", async () => {
  await api(`/cart/${secondProduct.id}`, "DELETE");
  const order = await checkout();
  await api(`/cart/${product.id}`, "DELETE");
  await api(`/cart/${product.id}`, "POST");
  const payment = gateway.payment(order.razorpayOrderId);
  assert.equal((await api("/orders/verify-payment", "POST", proof(order, payment))).status, 200);
  assert.equal((await api("/cart")).body.cart[0].quantity, 1);
});
test("an order can recover a lost browser callback without signed browser proof", async () => {
  const order = await checkout();
  gateway.payment(order.razorpayOrderId);
  const checked = await api(`/orders/${order.shopKartOrderId}/reconcile`, "POST");
  assert.equal(checked.body.order.paymentStatus, "PAID");
  assert.equal((await api("/cart")).body.cart.length, 0);
});
test("signed webhook settles without the customer tab and duplicate delivery is safe", async () => {
  await api(`/cart/${product.id}`, "POST");
  const order = await checkout();
  const payment = gateway.payment(order.razorpayOrderId);
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  const stockBefore = (await Product.findById(product.id)).stock;
  for (let i = 0; i < 2; i++) {
    const response = await fetch(base + "/webhooks/razorpay", { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": signature }, body });
    assert.equal(response.status, 200);
  }
  assert.equal((await Order.findById(order.shopKartOrderId)).paymentStatus, "PAID");
  assert.equal((await Product.findById(product.id)).stock, stockBefore - 1);
});
test("stock conflict rolls back all deductions and durably records payment review", async () => {
  await api(`/cart/${product.id}`, "POST");
  await api(`/cart/${secondProduct.id}`, "POST");
  const order = await checkout();
  const stockBefore = (await Product.findById(product.id)).stock;
  await Product.updateOne({ _id: secondProduct.id }, { $set: { stock: 0 } });
  const payment = gateway.payment(order.razorpayOrderId);
  const result = await api("/orders/verify-payment", "POST", proof(order, payment));
  assert.equal(result.body.order.paymentStatus, "PAID"); assert.equal(result.body.order.status, "PAYMENT_REVIEW");
  assert.equal((await Product.findById(product.id)).stock, stockBefore);
  assert.equal((await api("/cart")).body.cart.length, 2);
  const blocked = await api("/orders/create-payment-order", "POST", { shippingAddress: address });
  assert.equal(blocked.status, 409); assert.equal(blocked.body.orderId, order.shopKartOrderId);
});
test("private orders reject another account and customers cannot change fulfilment", async () => {
  const order = await Order.findOne();
  assert.equal((await api(`/orders/${order.id}/status`, "PATCH", { status: "CONFIRMED" })).status, 403);
  await api("/users/register", "POST", { ...address, email: "other@example.test", password: "test-password" });
  const other = await api("/users/login", "POST", { email: "other@example.test", password: "test-password" });
  assert.equal((await api(`/orders/${order.id}`, "GET", undefined, other.cookie)).status, 403);
  assert.equal((await api(`/orders/${order.id}/reconcile`, "POST", {}, other.cookie)).status, 404);
});

test("a trusted operator can resolve a customer's reviewed order exactly once", async () => {
  const order = await Order.findOne({ status: "PAYMENT_REVIEW" });
  assert.equal((await api(`/orders/${order.id}/retry-fulfillment`, "POST")).status, 403);
  await api("/users/register", "POST", { ...address, email: "operator@example.test", password: "test-password" });
  process.env.ADMIN_EMAILS = "operator@example.test";
  const operator = await api("/users/login", "POST", { email: "operator@example.test", password: "test-password" });
  assert.equal((await api(`/orders/${order.id}`, "GET", undefined, operator.cookie)).status, 200);
  const stillUnavailable = await api(`/orders/${order.id}/retry-fulfillment`, "POST", {}, operator.cookie);
  assert.equal(stillUnavailable.body.order.status, "PAYMENT_REVIEW");
  const stockBefore = (await Product.findById(product.id)).stock;
  assert.equal((await api(`/products/${secondProduct.id}/stock`, "PATCH", { stock: 5 })).status, 403);
  assert.equal((await api(`/products/${secondProduct.id}/stock`, "PATCH", { stock: 5 }, operator.cookie)).status, 200);
  const attempts = await Promise.all([api(`/orders/${order.id}/retry-fulfillment`, "POST", {}, operator.cookie), api(`/orders/${order.id}/retry-fulfillment`, "POST", {}, operator.cookie)]);
  assert.ok(attempts.every(result => [200, 409].includes(result.status)));
  assert.equal((await Order.findById(order.id)).status, "PLACED");
  assert.equal((await Product.findById(product.id)).stock, stockBefore - 1);
  assert.equal((await Product.findById(secondProduct.id)).stock, 4);
  assert.equal((await api("/cart")).body.cart.length, 0);
  assert.equal((await api(`/orders/${order.id}/status`, "PATCH", { status: "CONFIRMED" }, operator.cookie)).status, 200);
});
