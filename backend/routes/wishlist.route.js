import express from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  toggleWishlist,
} from "../controllers/wishlist.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const wishlistRoutes = express.Router();

// All wishlist routes are protected
wishlistRoutes.use(isAuthenticated);

wishlistRoutes.get("/", getWishlist);
wishlistRoutes.post("/:productId", addToWishlist);
wishlistRoutes.delete("/:productId", removeFromWishlist);
wishlistRoutes.patch("/:productId/toggle", toggleWishlist);

export default wishlistRoutes;
