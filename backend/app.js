import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import customerRoutes, { createCustomerRoutes } from "./routes/customer.route.js";
import productRoutes from "./routes/product.route.js";
import wishlistRoutes from "./routes/wishlist.route.js";
import cartRoutes from "./routes/cart.route.js";
import orderRoutes from "./routes/order.route.js";
import { paymentWebhook } from "./controllers/payment-recovery.controller.js";
import { rateLimit } from "express-rate-limit";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (/^[1-9]\d*$/.test(process.env.TRUST_PROXY || "")) app.set("trust proxy", Number(process.env.TRUST_PROXY));
  const origins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map(origin => origin.trim()).filter(Boolean);
  app.use(cors({
    origin: origins,
    credentials: true,
  }));
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": "no-store" });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") && !origins.includes(req.get("origin"))) {
      return res.status(403).json({ success: false, message: "Request origin is not allowed" });
    }
    next();
  });
  // The HMAC must cover the exact raw request bytes, before JSON parsing.
  app.post("/webhooks/razorpay", express.raw({ type: "application/json", limit: "100kb" }), paymentWebhook);
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/", (req, res) => res.json({ name: "ShopKart API", version: "1.0.0", health: "/health" }));
  app.get("/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ success: connected, service: "shopkart-api", database: connected ? "connected" : "unavailable" });
  });
  app.use(["/users/login", "/users/register", "/customers/login", "/customers/register", "/customers/change-password", "/users/change-password"], rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false,
    skipSuccessfulRequests: true, message: { success: false, message: "Too many sign-in attempts. Please try again in 15 minutes." },
  }));
  app.use("/users", customerRoutes);
  app.use("/customers", createCustomerRoutes());
  app.use("/products", productRoutes);
  app.use("/wishlist", wishlistRoutes);
  app.use("/cart", cartRoutes);
  app.use("/orders", orderRoutes);
  app.use((req, res) => res.status(404).json({ success: false, message: "API route not found" }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    res.status(status).json({ success: false, message: status === 400 ? "Invalid request body" : status === 413 ? "Request body too large" : "Unable to process request" });
  });
  return app;
}
