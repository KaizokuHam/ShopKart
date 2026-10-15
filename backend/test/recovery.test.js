import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { paymentWebhook } from "../controllers/payment-recovery.controller.js";
import { validateRuntimeConfig } from "../config/runtime.js";

const original = Object.fromEntries(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"].map(key => [key, process.env[key]]));
afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const configure = () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_isolated";
  process.env.RAZORPAY_KEY_SECRET = "test-api-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
};
const signed = body => ({ body: Buffer.from(body), get: () => crypto.createHmac("sha256", "test-webhook-secret").update(body).digest("hex") });

test("webhook rejects forgery and changes to signed request bytes", async () => {
  configure();
  const req = signed('{"event":"payment.captured"}');
  req.body = Buffer.from('{"event":"payment.failed"}');
  const res = response(); await paymentWebhook(req, res);
  assert.equal(res.code, 400);
});
test("webhook authenticates before parsing and safely ignores unsupported events", async () => {
  configure();
  const ignored = response(); await paymentWebhook(signed('{"event":"subscription.activated"}'), ignored);
  assert.equal(ignored.code, 200); assert.equal(ignored.body.ignored, true);
  const invalid = response(); await paymentWebhook(signed('{'), invalid); assert.equal(invalid.code, 400);
  const incomplete = response(); await paymentWebhook(signed('{"event":"payment.captured"}'), incomplete); assert.equal(incomplete.code, 400);
});
test("production startup fails on incomplete or unsafe deployment configuration", () => {
  const env = { NODE_ENV: "production", dbUrl: "mongodb://example/test", jwt_secret: "x".repeat(32), CLIENT_ORIGIN: "https://shop.example", RAZORPAY_KEY_ID: "rzp_test_valid", RAZORPAY_KEY_SECRET: "private-secret", RAZORPAY_WEBHOOK_SECRET: "private-webhook" };
  assert.doesNotThrow(() => validateRuntimeConfig(env));
  for (const change of [{ jwt_secret: "short" }, { CLIENT_ORIGIN: "http://shop.example" }, { CLIENT_ORIGIN: "https://shop.example/path" }, { RAZORPAY_WEBHOOK_SECRET: "" }, { COOKIE_SAME_SITE: "anything" }, { TRUST_PROXY: "true" }, { PORT: "socket" }, { PORT: "70000" }, { RAZORPAY_KEY_ID: "rzp_live_forbidden" }]) {
    assert.throws(() => validateRuntimeConfig({ ...env, ...change }));
  }
});
