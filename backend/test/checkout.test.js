import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import razorpay from "../config/razorpay.js";
import { createPaymentOrder, verifyPayment, getOrderById, updateOrderStatus, reportPaymentResult } from "../controllers/order.controller.js";
import { updateCartQuantity, addToCart } from "../controllers/cart.controller.js";
import { registerCustomer, loginCustomer } from "../controllers/customer.controller.js";

const userId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
const address = { fullName: "A Test", phone: "9876543210", addressLine1: "12 Street", city: "Pune", state: "Maharashtra", pincode: "411001" };
const originalEnv = { key: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET, admin: process.env.ADMIN_EMAILS };
const restores = [];
const stub = (object, key, value) => { const original = object[key]; object[key] = value; restores.push(() => { object[key] = original; }); };
afterEach(() => {
  while (restores.length) restores.pop()();
  for (const [key, value] of [["RAZORPAY_KEY_ID", originalEnv.key], ["RAZORPAY_KEY_SECRET", originalEnv.secret], ["ADMIN_EMAILS", originalEnv.admin]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = (body = {}) => ({ body, user: { _id: userId }, params: {} });
const configure = () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_regression"; process.env.RAZORPAY_KEY_SECRET = "regression-secret";
  stub(razorpay.payments, "fetch", async () => ({ order_id: "order_regression", amount: 10000, currency: "INR", status: "captured" }));
  stub(Order, "findOne", async () => null);
};
const orderFixture = () => ({ _id: orderId, user: userId, totalAmount: 100, items: [{ product: productId, quantity: 2, name: "Keyboard" }], paymentStatus: "PENDING", status: "PENDING_PAYMENT", razorpayOrderId: "order_regression", async save() {} });
const stubOrder = order => stub(Order, "findById", () => Object.assign(Promise.resolve(order), { session: async () => order }));
const payload = () => ({ shopKartOrderId: orderId.toString(), razorpay_order_id: "order_regression", razorpay_payment_id: "pay_regression", razorpay_signature: crypto.createHmac("sha256", "regression-secret").update("order_regression|pay_regression").digest("hex") });

test("shipping values of the wrong type return 400 rather than crash", async () => {
  const res = response(); await createPaymentOrder(request({ shippingAddress: { ...address, phone: 123 } }), res);
  assert.equal(res.code, 400);
});
test("whitespace shipping fields are rejected", async () => {
  const res = response(); await createPaymentOrder(request({ shippingAddress: { ...address, city: "  " } }), res);
  assert.equal(res.code, 400);
});
test("checkout requires real Test Mode configuration", async () => {
  delete process.env.RAZORPAY_KEY_ID;
  const res = response(); await createPaymentOrder(request({ shippingAddress: address }), res);
  assert.equal(res.code, 503);
});
test("empty carts are rejected", async () => {
  configure(); stub(Customer, "findById", async () => ({ cart: [] }));
  const res = response(); await createPaymentOrder(request({ shippingAddress: address }), res); assert.equal(res.code, 400);
});
test("deleted products block checkout", async () => {
  configure(); stub(Customer, "findById", async () => ({ cart: [{ product: productId, quantity: 1 }] })); stub(Product, "findById", async () => null);
  const res = response(); await createPaymentOrder(request({ shippingAddress: address }), res); assert.equal(res.code, 400);
});
test("insufficient stock blocks checkout", async () => {
  configure(); stub(Customer, "findById", async () => ({ cart: [{ product: productId, quantity: 3 }] })); stub(Product, "findById", async () => ({ name: "Keyboard", stock: 2 }));
  const res = response(); await createPaymentOrder(request({ shippingAddress: address }), res); assert.equal(res.code, 400);
});
test("checkout snapshots server prices and calculates exact paise, ignoring client totals", async () => {
  configure(); const customer = { cart: [{ product: productId, quantity: 3 }] };
  stub(Customer, "findById", async () => customer);
  stub(Product, "findById", async () => ({ _id: productId, name: "Keyboard", stock: 5, price: 10.1, image: "image" }));
  let created;
  stub(Order, "create", async data => { created = data; return { ...data, _id: orderId, async save() {} }; });
  stub(razorpay.orders, "create", async data => { assert.equal(data.amount, 3030); return { id: "order_regression" }; });
  const res = response(); await createPaymentOrder(request({ shippingAddress: address, totalAmount: 1 }), res);
  assert.equal(res.code, 200); assert.equal(created.totalAmount, 30.3); assert.equal(created.items[0].price, 10.1); assert.equal(customer.cart.length, 1);
});
test("provider errors never produce a fake order or clear cart", async () => {
  configure(); const customer = { cart: [{ product: productId, quantity: 1 }] };
  stub(Customer, "findById", async () => customer);
  stub(Product, "findById", async () => ({ _id: productId, name: "Keyboard", stock: 5, price: 10 }));
  const order = orderFixture(); stub(Order, "create", async () => order);
  stub(razorpay.orders, "create", async () => { throw new Error("provider unavailable"); });
  const res = response(); await createPaymentOrder(request({ shippingAddress: address }), res);
  assert.equal(res.code, 502); assert.equal(order.paymentStatus, "FAILED"); assert.equal(customer.cart.length, 1);
});
test("simulation signatures cannot confirm an order", async () => {
  configure(); const order = orderFixture(); stubOrder(order);
  const res = response(); await verifyPayment(request({ ...payload(), razorpay_signature: "valid_test_sig_pay_regression" }), res);
  assert.equal(res.code, 400); assert.equal(order.paymentStatus, "PENDING");
});
test("incorrect HMAC cannot downgrade a paid order", async () => {
  configure(); const order = orderFixture(); order.paymentStatus = "PAID"; stubOrder(order);
  const res = response(); await verifyPayment(request({ ...payload(), razorpay_signature: "0".repeat(64) }), res);
  assert.equal(res.code, 400); assert.equal(order.paymentStatus, "PAID");
});
test("gateway order IDs must match the stored order", async () => {
  configure(); stubOrder(orderFixture()); const res = response();
  await verifyPayment(request({ ...payload(), razorpay_order_id: "order_other" }), res); assert.equal(res.code, 400);
});
test("verified payment commits with a session and repeated verification has no side effects", async () => {
  configure(); const order = orderFixture(); stubOrder(order); const session = {};
  stub(mongoose.connection, "transaction", async callback => callback(session));
  let deductions = 0, clears = 0;
  stub(Product, "updateOne", async (filter, update, options) => { assert.equal(filter.stock.$gte, 2); assert.equal(update.$inc.stock, -2); assert.equal(options.session, session); deductions++; return { modifiedCount: 1 }; });
  stub(Customer, "updateOne", async (_filter, update, options) => { assert.ok(Array.isArray(update)); assert.equal(options.updatePipeline, true); assert.equal(options.session, session); clears++; return { matchedCount: 1 }; });
  const first = response(); await verifyPayment(request(payload()), first); assert.equal(first.code, 200);
  const second = response(); await verifyPayment(request(payload()), second); assert.equal(second.code, 200);
  assert.equal(order.paymentStatus, "PAID"); assert.equal(deductions, 1); assert.equal(clears, 1);
});
test("stock shortages record a captured payment for review without clearing the cart", async () => {
  configure(); const order = orderFixture(); stubOrder(order);
  stub(mongoose.connection, "transaction", async callback => callback({}));
  stub(Product, "updateOne", async () => ({ modifiedCount: 0 }));
  stub(Customer, "updateOne", async () => { assert.fail("Cart must not be cleared"); });
  stub(Order, "findOneAndUpdate", async (_filter, update) => Object.assign(order, update.$set));
  const res = response(); await verifyPayment(request(payload()), res);
  assert.equal(res.code, 200); assert.equal(order.paymentStatus, "PAID"); assert.equal(order.status, "PAYMENT_REVIEW");
});
test("other users cannot read or verify the order", async () => {
  configure(); const order = orderFixture(); order.user = new mongoose.Types.ObjectId(); stubOrder(order);
  const res = response(); await verifyPayment(request(payload()), res); assert.equal(res.code, 403);
  const details = response(); await getOrderById({ ...request(), params: { id: orderId.toString() } }, details); assert.equal(details.code, 403);
});
test("fractional, non-finite and string cart quantities are rejected", async () => {
  for (const quantity of [0, -1, 1.5, Infinity, "2"]) {
    const res = response(); await updateCartQuantity({ ...request({ quantity }), params: { productId: productId.toString() } }, res); assert.equal(res.code, 400);
  }
});
test("cart additions use an atomic pipeline with a stock bound", async () => {
  stub(Product, "findById", async () => ({ stock: 2 }));
  stub(Customer, "findOneAndUpdate", (filter, update, options) => {
    assert.equal(filter.cart.$not.$elemMatch.quantity.$gte, 2);
    assert.ok(Array.isArray(update)); assert.equal(options.updatePipeline, true);
    return { populate: async () => ({ cart: [{ product: { _id: productId }, quantity: 1 }] }) };
  });
  const res = response(); await addToCart({ ...request(), params: { productId: productId.toString() } }, res); assert.equal(res.code, 200);
});
test("unpaid orders cannot progress to fulfilment", async () => {
  process.env.ADMIN_EMAILS = "operator@example.test";
  stubOrder(orderFixture()); const res = response(); await updateOrderStatus({ ...request({ status: "SHIPPED" }), user: { _id: userId, email: "operator@example.test" }, params: { id: orderId.toString() } }, res); assert.equal(res.code, 400);
});
test("schemas reject fractional stock and quantities", async () => {
  const product = new Product({ name: "Test", description: "Test", category: "Test", image: "image", price: 10, stock: 1.5 });
  await assert.rejects(product.validate(), error => Boolean(error.errors.stock));
  const customer = new Customer({ fullName: "Test", email: "test@example.com", password: "hash", phone: "9876543210", cart: [{ product: productId, quantity: 1.5 }] });
  await assert.rejects(customer.validate(), error => Boolean(error.errors["cart.0.quantity"]));
});
test("authentication inputs reject non-string values", async () => {
  const login = response(); await loginCustomer(request({ email: {}, password: 123 }), login); assert.equal(login.code, 400);
  const registration = response(); await registerCustomer(request({ fullName: "  ", email: "a@b.com", password: "abcdef", phone: "9876543210" }), registration); assert.equal(registration.code, 400);
});

test("authorized payments remain pending without changing inventory or cart", async () => {
  configure(); stubOrder(orderFixture());
  stub(razorpay.payments, "fetch", async () => ({ order_id: "order_regression", amount: 10000, currency: "INR", status: "authorized" }));
  stub(Order, "updateOne", async () => ({ modifiedCount: 1 }));
  stub(mongoose.connection, "transaction", async () => assert.fail("Uncaptured payments cannot confirm an order"));
  const res = response(); await verifyPayment(request(payload()), res); assert.equal(res.code, 202); assert.equal(res.body.retryVerification, true);
});
test("payment amount and currency must match the order snapshot", async () => {
  configure(); stubOrder(orderFixture());
  stub(razorpay.payments, "fetch", async () => ({ order_id: "order_regression", amount: 1, currency: "USD", status: "captured" }));
  const res = response(); await verifyPayment(request(payload()), res); assert.equal(res.code, 400);
});
test("provider outages allow confirmation retry without calling transaction", async () => {
  configure(); stubOrder(orderFixture());
  stub(razorpay.payments, "fetch", async () => { throw new Error("Provider timeout"); });
  const res = response(); await verifyPayment(request(payload()), res); assert.equal(res.code, 502); assert.equal(res.body.retryVerification, true);
});
test("a provider-confirmed failed payment cannot confirm an order", async () => {
  configure(); stubOrder(orderFixture());
  stub(razorpay.payments, "fetch", async () => ({ order_id: "order_regression", amount: 10000, currency: "INR", status: "failed" }));
  stub(Order, "updateOne", async (_filter, update) => { assert.equal(update.$set.paymentStatus, "FAILED"); return { modifiedCount: 1 }; });
  const res = response(); await verifyPayment(request(payload()), res); assert.equal(res.code, 400); assert.equal(res.body.paymentFailed, true);
});
test("failure events persist FAILED and leave cart alone", async () => {
  configure(); const order = orderFixture(); stubOrder(order);
  stub(razorpay.payments, "fetch", async () => ({ order_id: "order_regression", status: "failed" }));
  stub(Order, "findOneAndUpdate", async (filter, update) => { assert.equal(filter.paymentStatus.$ne, "PAID"); assert.equal(update.$set.paymentStatus, "FAILED"); return { ...order, ...update.$set }; });
  const res = response(); await reportPaymentResult({ ...request({ outcome: "FAILED", paymentId: "pay_failed" }), params: { id: orderId.toString() } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.order.paymentAttemptStatus, "FAILED");
});
test("cancellation is distinct from payment failure", async () => {
  stubOrder(orderFixture());
  stub(Order, "findOneAndUpdate", async (_filter, update) => { assert.equal(update.$set.paymentAttemptStatus, "CANCELLED"); assert.equal(update.$set.paymentStatus, undefined); return update.$set; });
  const res = response(); await reportPaymentResult({ ...request({ outcome: "CANCELLED" }), params: { id: orderId.toString() } }, res); assert.equal(res.code, 200);
});
test("a late failure cannot downgrade a paid order", async () => {
  const order = orderFixture(); order.paymentStatus = "PAID"; stubOrder(order);
  stub(Order, "findOneAndUpdate", async () => assert.fail("Paid orders must not be downgraded"));
  const res = response(); await reportPaymentResult({ ...request({ outcome: "FAILED" }), params: { id: orderId.toString() } }, res); assert.equal(res.body.order.paymentStatus, "PAID");
});
test("a failure report cannot reference another order's payment", async () => {
  configure(); stubOrder(orderFixture()); stub(razorpay.payments, "fetch", async () => ({ order_id: "order_other", status: "failed" }));
  const res = response(); await reportPaymentResult({ ...request({ outcome: "FAILED", paymentId: "pay_other" }), params: { id: orderId.toString() } }, res); assert.equal(res.code, 400);
});
