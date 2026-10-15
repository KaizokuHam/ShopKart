import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaymentLifecycle, readPendingPayment, savePendingPayment } from "../src/utils/paymentLifecycle.js";

const callback = { razorpay_order_id: "order_test", razorpay_payment_id: "pay_test", razorpay_signature: "signature" };
const fixture = (verify = async () => ({ success: true, order: { _id: "local", paymentStatus: "PAID" } })) => {
  const states = [], reports = [], saved = [], orders = [];
  const lifecycle = createPaymentLifecycle({ orderId: "local", verify, report: async (...args) => reports.push(args), persist: value => saved.push(value), onState: state => states.push(state), onSuccess: order => orders.push(order) });
  return { lifecycle, states, reports, saved, orders };
};

test("success followed by dismiss confirms once and never reports cancellation", async () => {
  const f = fixture(); await f.lifecycle.success(callback); await f.lifecycle.dismiss(); await f.lifecycle.success(callback);
  assert.equal(f.orders.length, 1); assert.equal(f.reports.length, 0); assert.equal(f.lifecycle.phase, "SUCCESS"); assert.equal(f.saved.at(-1), null);
});
test("dismiss while verification is in flight does not overwrite success", async () => {
  let resolve;
  const f = fixture(() => new Promise(done => { resolve = done; }));
  const pending = f.lifecycle.success(callback); await f.lifecycle.dismiss();
  assert.equal(f.lifecycle.phase, "VERIFYING"); assert.equal(f.reports.length, 0);
  resolve({ success: true, order: { paymentStatus: "PAID" } }); await pending; assert.equal(f.orders.length, 1);
});
test("failure followed by dismiss stays failed and records the provider payment ID", async () => {
  const f = fixture(); await f.lifecycle.failure({ error: { description: "Declined", metadata: { payment_id: "pay_failed" } } }); await f.lifecycle.dismiss();
  assert.equal(f.lifecycle.phase, "FAILED"); assert.deepEqual(f.reports, [["local", "FAILED", "pay_failed"]]); assert.equal(f.orders.length, 0);
});
test("cancellation preserves cart and records a distinct cancellation", async () => {
  const f = fixture(); await f.lifecycle.dismiss(); assert.equal(f.lifecycle.phase, "CANCELLED"); assert.equal(f.orders.length, 0); assert.equal(f.reports[0][1], "CANCELLED");
});
test("network failure keeps proof for retrying the same payment", async () => {
  let calls = 0;
  const f = fixture(async payload => { assert.equal(payload.razorpay_payment_id, "pay_test"); if (++calls === 1) throw new Error("Network down"); return { success: true, order: { paymentStatus: "PAID" } }; });
  await f.lifecycle.success(callback); assert.equal(f.lifecycle.phase, "PENDING"); assert.equal(f.orders.length, 0);
  await f.lifecycle.retry(f.saved.at(-1)); assert.equal(f.lifecycle.phase, "SUCCESS"); assert.equal(calls, 2);
});
test("authorized but uncaptured payments cannot produce a success screen", async () => {
  const f = fixture(async () => ({ success: false, retryVerification: true, message: "Processing" }));
  await f.lifecycle.success(callback); assert.equal(f.lifecycle.phase, "PENDING"); assert.equal(f.orders.length, 0); assert.ok(f.saved.at(-1));
});
test("provider-confirmed failure removes pending proof and allows a new attempt", async () => {
  const f = fixture(async () => { throw { response: { data: { paymentFailed: true, message: "Payment failed" } } }; });
  await f.lifecycle.success(callback); assert.equal(f.lifecycle.phase, "FAILED"); assert.equal(f.saved.at(-1), null);
});
test("a late authentic success can supersede dismissal", async () => {
  const f = fixture(); await f.lifecycle.dismiss(); await f.lifecycle.success(callback); assert.equal(f.lifecycle.phase, "SUCCESS"); assert.equal(f.orders.length, 1);
});
test("pending proof is recoverable and malformed storage is ignored", () => {
  const values = new Map(); const storage = { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
  const proof = { shopKartOrderId: "local", ...callback };
  savePendingPayment(storage, "user", proof); assert.deepEqual(readPendingPayment(storage, "user"), proof);
  values.set("user", "invalid JSON"); assert.equal(readPendingPayment(storage, "user"), null);
  savePendingPayment(storage, "user", null); assert.equal(readPendingPayment(storage, "user"), null);
});

test("an uncertain failure report blocks a new payment", async () => {
  let state;
  const lifecycle = createPaymentLifecycle({ orderId: "local", verify: async () => {}, report: async () => ({ success: false, message: "Still processing" }), persist: () => {}, onState: value => { state = value; }, onSuccess: () => assert.fail("No confirmed order") });
  await lifecycle.failure({ error: {} }); assert.equal(lifecycle.phase, "PENDING"); assert.equal(state.orderId, "local");
});

test("failure reporting locks checkout and a late success cannot be overwritten", async () => {
  let resolveReport;
  const orders = [];
  const lifecycle = createPaymentLifecycle({ orderId: "local", verify: async () => ({ success: true, order: { paymentStatus: "PAID" } }), report: () => new Promise(resolve => { resolveReport = resolve; }), persist: () => {}, onState: () => {}, onSuccess: order => orders.push(order) });
  const reporting = lifecycle.failure({ error: {} });
  assert.equal(lifecycle.phase, "REPORTING");
  await lifecycle.dismiss();
  await lifecycle.success(callback);
  resolveReport({ success: true, order: { paymentStatus: "FAILED" } });
  await reporting;
  assert.equal(lifecycle.phase, "SUCCESS");
  assert.equal(orders.length, 1);
});
