import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { isAdminEmail, requireAdmin } from "../middleware/admin.middleware.js";
import { createProduct } from "../controllers/product.controller.js";
import { registerCustomer, loginCustomer } from "../controllers/customer.controller.js";

let server, base;
const originalAdmins = process.env.ADMIN_EMAILS;
const originalOrigin = process.env.CLIENT_ORIGIN;
before(async () => {
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  server = createApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  if (originalOrigin === undefined) delete process.env.CLIENT_ORIGIN;
  else process.env.CLIENT_ORIGIN = originalOrigin;
});
afterEach(() => {
  if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdmins;
});

test("API root identifies the service and unknown routes return JSON 404", async () => {
  const root = await fetch(base);
  assert.equal((await root.json()).name, "ShopKart API");
  assert.equal(root.headers.has("x-powered-by"), false);
  const missing = await fetch(base + "/does-not-exist");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).success, false);
});
test("health reports unavailable storage without claiming readiness", async () => {
  assert.notEqual(mongoose.connection.readyState, 1);
  const response = await fetch(base + "/health");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database, "unavailable");
});
test("anonymous clients cannot write products or access private commerce routes", async () => {
  for (const [path, method] of [["/products", "POST"], ["/cart", "GET"], ["/orders", "GET"], ["/wishlist", "GET"]]) {
    const response = await fetch(base + path, { method });
    assert.equal(response.status, 401, path);
  }
});
test("malformed and excessive JSON return controlled errors", async () => {
  const malformed = await fetch(base + "/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  const large = await fetch(base + "/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(110000) }) });
  assert.equal(large.status, 413);
});
test("CORS credentials are returned only for the configured browser origin", async () => {
  const allowed = await fetch(base, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
  const other = await fetch(base, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});
test("administrative writes require an explicitly configured trusted email", () => {
  process.env.ADMIN_EMAILS = " Owner@example.com, second@example.com ";
  assert.equal(isAdminEmail("owner@example.com"), true);
  assert.equal(isAdminEmail("stranger@example.com"), false);
  assert.equal(isAdminEmail(undefined), false);
  let denied;
  const res = { status(code) { denied = code; return this; }, json() {} };
  requireAdmin({ user: { email: "stranger@example.com" } }, res, () => assert.fail("Customer may not advance fulfilment"));
  assert.equal(denied, 403);
  let authorized = false;
  requireAdmin({ user: { email: "owner@example.com" } }, res, () => { authorized = true; });
  assert.equal(authorized, true);
});
test("malformed product input is rejected before reaching the database", async () => {
  for (const body of [undefined, { name: {}, description: "text", price: 10, stock: 2, category: "Home", image: "https://example.com/a.jpg" }, { name: "Lamp", description: "text", price: 10, stock: 2, category: "Home", image: "javascript:alert(1)" }]) {
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    await createProduct({ body }, res);
    assert.equal(status, 400);
  }
});

test("public signup cannot claim an allowlisted administrator email", async () => {
  process.env.ADMIN_EMAILS = "reserved@example.com";
  let status;
  const res = { status(code) { status = code; return this; }, json() {} };
  await registerCustomer({ body: { fullName: "Unknown", email: "RESERVED@example.com", password: "password123", phone: "9876543210" } }, res);
  assert.equal(status, 403);
});

test("passwords exceeding bcrypt's byte limit are rejected in signup and login", async () => {
  const body = { fullName: "Test", email: "byte-limit@example.com", password: "é".repeat(40), phone: "9876543210" };
  for (const handler of [registerCustomer, loginCustomer]) {
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    await handler({ body }, res);
    assert.equal(status, 400);
  }
});

test("cross-origin browser writes are rejected and logout cannot be triggered by GET", async () => {
  const response = await fetch(base + "/users/login", { method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 403);
  assert.equal((await fetch(base + "/users/logout")).status, 404);
});

test("repeated failed authentication requests are rate limited", async () => {
  let status;
  for (let index = 0; index < 31; index++) {
    const response = await fetch(base + "/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    status = response.status;
  }
  assert.equal(status, 429);
});
