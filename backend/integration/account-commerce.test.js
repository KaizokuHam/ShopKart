import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { testDatabase } from "../testing/database.js";
import { testGateway } from "../testing/gateway.js";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";

let closeDb, server, base, cookie, rawCookie, customerId, keyboard, book, gateway;
const email = "customer@example.test";
const password = "customer-password";
const fields = { fullName: "Test Customer", email, password, phone: "9876543210" };
const shippingAddress = { fullName: fields.fullName, phone: fields.phone, addressLine1: "12 Lab Road", city: "Pune", state: "Maharashtra", pincode: "411001" };
const api = async (path, method = "GET", body, token = cookie) => {
  const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await res.json();
  return { status: res.status, data, cookie: res.headers.get("set-cookie")?.split(";")[0], cookieHeader: res.headers.get("set-cookie") };
};
before(async () => {
  process.env.NODE_ENV = "test"; process.env.jwt_secret = "account-test-secret-for-isolated-session"; process.env.ADMIN_EMAILS = "";
  closeDb = await testDatabase(); gateway = testGateway();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 1200000 });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (closeDb) await closeDb(); });

test("canonical registration, validation, bcrypt, private profile and HttpOnly login", async () => {
  assert.equal((await api("/customers/me", "GET", undefined, "")).status, 401);
  assert.equal((await api("/customers/logout", "POST", {}, "")).status, 401);
  for (const change of [{ fullName: "" }, { password: "123" }, { phone: "" }]) assert.equal((await api("/customers/register", "POST", { ...fields, ...change })).status, 400);
  const registered = await api("/customers/register", "POST", fields);
  assert.equal(registered.status, 201); assert.equal(registered.data.success, true);
  customerId = registered.data.customer._id; assert.ok(customerId);
  assert.equal(registered.data.customer.password, undefined);
  const stored = await Customer.findById(customerId); assert.notEqual(stored.password, password); assert.equal(await bcrypt.compare(password, stored.password), true);
  assert.equal((await api("/customers/register", "POST", fields)).status, 409);
  const wrong = await api("/customers/login", "POST", { email, password: "wrong" });
  const unknown = await api("/customers/login", "POST", { email: "missing@example.test", password: "wrong" });
  assert.equal(wrong.status, 401); assert.deepEqual(wrong.data, unknown.data);
  const loggedIn = await api("/customers/login", "POST", { email, password });
  assert.equal(loggedIn.data.success, true); assert.match(loggedIn.cookieHeader, /HttpOnly/i);
  cookie = loggedIn.cookie; rawCookie = cookie;
  const me = await api("/customers/me");
  assert.equal(me.status, 200); assert.equal(me.data._id, customerId); assert.equal(me.data.phone, fields.phone);
  assert.equal(me.data.password, undefined); assert.equal(me.data.authenticatedUser, undefined);
  assert.equal((await api("/customers/me", "GET", undefined, "token=invalid")).status, 401);
});

test("password change checks old password, hashes the new one and expires other sessions", async () => {
  assert.equal((await api("/customers/change-password", "PATCH", { oldPassword: "wrong", newPassword: "updated-password" })).status, 401);
  assert.equal((await api("/customers/change-password", "PATCH", { oldPassword: password, newPassword: "123" })).status, 400);
  const changed = await api("/customers/change-password", "PATCH", { oldPassword: password, newPassword: "updated-password" });
  assert.equal(changed.status, 200); assert.equal(changed.data.success, true); cookie = changed.cookie;
  assert.equal((await api("/customers/me", "GET", undefined, rawCookie)).status, 401);
  assert.equal((await api("/customers/me")).status, 200);
  assert.equal(await bcrypt.compare("updated-password", (await Customer.findById(customerId)).password), true);
  assert.equal((await api("/customers/login", "POST", { email, password })).status, 401);
  const login = await api("/customers/login", "POST", { email, password: "updated-password" }); cookie = login.cookie;
});

test("product creation, validation, combined search/category, sorting and detail errors", async () => {
  process.env.ADMIN_EMAILS = email;
  const template = { name: "Mechanical Keyboard", description: "RGB switches", price: 2999, stock: 5, category: "Electronics", image: "https://example.test/keyboard.jpg" };
  for (const change of [{ price: 0 }, { stock: -1 }, { name: "" }]) assert.equal((await api("/products", "POST", { ...template, ...change })).status, 400);
  const created = await api("/products", "POST", template); assert.equal(created.status, 201); keyboard = created.data;
  book = (await api("/products", "POST", { ...template, name: "Keyboard Guide", category: "Books", price: 499 })).data;
  const searched = await api("/products?search=KEYBOARD&category=Electronics");
  assert.equal(searched.data.count, 1); assert.equal(searched.data.products[0]._id, keyboard._id);
  assert.deepEqual((await api("/products?sort=price_asc")).data.products.map(p => p.price), [499, 2999]);
  assert.deepEqual((await api("/products?sort=price_desc")).data.products.map(p => p.price), [2999, 499]);
  assert.equal((await api("/products?search=not-a-real-product")).data.count, 0);
  assert.equal((await api(`/products/${keyboard._id}`)).data.description, template.description);
  assert.equal((await api("/products/invalid")).status, 400);
  assert.equal((await api(`/products/${new mongoose.Types.ObjectId()}`)).status, 404);
});

test("wishlist reference, base POST duplicate contract, populate, persistence and removal", async () => {
  assert.equal((await api(`/wishlist/${keyboard._id}`, "POST")).status, 200);
  assert.equal((await api(`/wishlist/${keyboard._id}`, "POST")).status, 409);
  assert.equal((await api("/wishlist/invalid", "POST")).status, 400);
  assert.equal((await api(`/wishlist/${new mongoose.Types.ObjectId()}`, "POST")).status, 404);
  const saved = (await api("/wishlist")).data;
  assert.equal(saved.count, 1); assert.equal(saved.wishlist[0].name, keyboard.name);
  assert.ok((await Customer.findById(customerId)).wishlist[0] instanceof mongoose.Types.ObjectId);
  assert.equal((await api("/wishlist", "GET", undefined, "")).status, 401);
  const logout = await api("/customers/logout", "POST", {}); assert.equal(logout.data.success, true); assert.match(logout.cookieHeader, /token=;/);
  cookie = (await api("/customers/login", "POST", { email, password: "updated-password" })).cookie;
  assert.equal((await api("/wishlist")).data.count, 1);
  assert.equal((await api(`/wishlist/${keyboard._id}`, "DELETE")).status, 200);
  assert.equal((await api(`/wishlist/${keyboard._id}`, "DELETE")).status, 404);
});

test("cart increments one row, populates, enforces quantity/stock and uses current prices", async () => {
  await api(`/cart/${keyboard._id}`, "POST"); await api(`/cart/${keyboard._id}`, "POST");
  let cart = (await api("/cart")).data.cart; assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 2);
  assert.equal((await api(`/cart/${keyboard._id}`, "PATCH", { quantity: 3 })).status, 200);
  for (const quantity of [0, 6, "3"]) assert.equal((await api(`/cart/${keyboard._id}`, "PATCH", { quantity })).status, 400);
  assert.equal((await api(`/cart/${book._id}`, "PATCH", { quantity: 1 })).status, 404);
  assert.equal((await api("/cart", "GET", undefined, "")).status, 401);
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: 3100 } });
  cart = (await api("/cart")).data.cart; assert.equal(cart[0].product.price, 3100);
  const stored = await Customer.findById(customerId); assert.equal(stored.cart[0].price, undefined); assert.equal(stored.subtotal, undefined);
});

test("validated shipping, server totals, immutable snapshots, signed payment and global-cart source", async () => {
  assert.equal((await api("/orders/create-payment-order", "POST", { shippingAddress: { ...shippingAddress, pincode: "123" } })).status, 400);
  const created = await api("/orders/create-payment-order", "POST", { shippingAddress, totalAmount: 1, items: [] });
  assert.equal(created.status, 200); assert.equal(created.data.amount, 930000); assert.equal(created.data.key.startsWith("rzp_test_"), true);
  assert.equal(JSON.stringify(created.data).includes(process.env.RAZORPAY_KEY_SECRET), false);
  assert.equal((await api("/cart")).data.cart.length, 1);
  const payment = gateway.payment(created.data.razorpayOrderId);
  const proof = { shopKartOrderId: created.data.shopKartOrderId, razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id, razorpay_signature: payment.signature };
  assert.equal((await api("/orders/verify-payment", "POST", { ...proof, razorpay_signature: "0".repeat(64) })).status, 400);
  assert.equal((await api("/cart")).data.cart.length, 1);
  const verified = await api("/orders/verify-payment", "POST", proof);
  assert.equal(verified.data.order.paymentStatus, "PAID"); assert.equal(verified.data.order.status, "PLACED");
  assert.equal((await api("/cart")).data.cart.length, 0);
  await Product.updateOne({ _id: keyboard._id }, { $set: { price: 4000 } });
  assert.equal((await api(`/orders/${proof.shopKartOrderId}`)).data.order.items[0].price, 3100);
  assert.equal((await api("/orders")).data.orders[0]._id, proof.shopKartOrderId);
  assert.equal((await api("/orders/create-payment-order", "POST", { shippingAddress })).status, 400);
  for (const status of ["CONFIRMED", "SHIPPED", "DELIVERED"]) assert.equal((await api(`/orders/${proof.shopKartOrderId}/status`, "PATCH", { status })).data.order.status, status);
});
