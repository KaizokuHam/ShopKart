import express from "express";
import cors from "cors";
import { createApp } from "../app.js";
import { testDatabase } from "./database.js";
import { testGateway } from "./gateway.js";
import Product from "../models/product.model.js";

if (process.env.SHOPKART_E2E !== "1") throw new Error("This isolated test server is available only to the E2E runner");
process.env.NODE_ENV = "test";
process.env.jwt_secret = "isolated-e2e-session-secret-not-for-deployment";
process.env.ADMIN_EMAILS = "";
process.env.CLIENT_ORIGIN = "http://127.0.0.1:5178";
const stopDatabase = await testDatabase();
const gateway = testGateway();
await Product.create([
  { name: "Test Desk Lamp", description: "A warm reading light", category: "Home", price: 100.25, stock: 100, image: "https://example.test/lamp.svg" },
  { name: "Test Field Notes", description: "Paper for everyday ideas", category: "Books", price: 50, stock: 100, image: "https://example.test/book.svg" },
]);
const app = express();
app.use("/__test", cors({ origin: "http://127.0.0.1:5178" }));
app.post("/__test/payment", express.json(), (req, res) => {
  const payment = gateway.payment(req.body.orderId, req.body.status);
  res.json({ razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id, razorpay_signature: payment.signature });
});
app.post("/__test/capture", express.json(), (req, res) => {
  const payment = gateway.payments.get(req.body.paymentId);
  if (!payment) return res.sendStatus(404);
  payment.status = "captured";
  return res.json({ success: true });
});
// Test controls never enter the production app or production route table.
app.use(createApp());
const server = app.listen(8096, "127.0.0.1");
const stop = () => server.close(async () => { await stopDatabase(); process.exit(0); });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
