import express from "express";
import {
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  reportPaymentResult,
} from "../controllers/order.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { reconcileOrder, retryFulfillment } from "../controllers/payment-recovery.controller.js";

const orderRoutes = express.Router();

// All order routes are protected with JWT authentication
orderRoutes.use(isAuthenticated);

orderRoutes.post("/create-payment-order", createPaymentOrder);
orderRoutes.post("/verify-payment", verifyPayment);
orderRoutes.post("/:id/payment-result", reportPaymentResult);
orderRoutes.post("/:id/reconcile", reconcileOrder);
orderRoutes.post("/:id/retry-fulfillment", requireAdmin, retryFulfillment);
orderRoutes.get("/", getMyOrders);
orderRoutes.get("/:id", getOrderById);
orderRoutes.patch("/:id/status", requireAdmin, updateOrderStatus);

export default orderRoutes;
