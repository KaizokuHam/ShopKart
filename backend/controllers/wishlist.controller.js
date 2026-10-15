import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";

const invalidId = (req, res) => {
  if (mongoose.isObjectIdOrHexString(req.params.productId)) return false;
  res.status(400).json({ success: false, message: "Invalid product ID" });
  return true;
};

export const getWishlist = async (req, res) => {
  const user = await Customer.findById(req.user._id).populate({ path: "wishlist", select: "name description price category image stock createdAt" });
  if (!user) return res.status(401).json({ success: false, message: "User not found" });
  const wishlist = (user.wishlist || []).filter(Boolean);
  return res.json({ success: true, count: wishlist.length, wishlist });
};

export const addToWishlist = async (req, res) => {
  if (invalidId(req, res)) return;
  const id = new mongoose.Types.ObjectId(req.params.productId);
  if (!await Product.exists({ _id: id })) return res.status(404).json({ success: false, message: "Product not found" });
  const result = await Customer.updateOne({ _id: req.user._id, wishlist: { $ne: id } }, { $addToSet: { wishlist: id }, $inc: { __v: 1 } });
  if (!result.matchedCount) return res.status(409).json({ success: false, message: "Product already in wishlist" });
  return res.json({ success: true, saved: true, message: "Product added to wishlist" });
};

export const removeFromWishlist = async (req, res) => {
  if (invalidId(req, res)) return;
  const id = new mongoose.Types.ObjectId(req.params.productId);
  const result = await Customer.updateOne({ _id: req.user._id, wishlist: id }, { $pull: { wishlist: id }, $inc: { __v: 1 } });
  if (!result.matchedCount) return res.status(404).json({ success: false, message: "Product not in wishlist" });
  return res.json({ success: true, saved: false, message: "Product removed from wishlist" });
};

export const toggleWishlist = async (req, res) => {
  if (invalidId(req, res)) return;
  const id = new mongoose.Types.ObjectId(req.params.productId);
  const exists = await Product.exists({ _id: id });
  const filter = { _id: req.user._id, ...(!exists ? { wishlist: id } : {}) };
  const user = await Customer.findOneAndUpdate(filter, [{ $set: {
    wishlist: { $cond: [
      { $in: [id, { $ifNull: ["$wishlist", []] }] },
      { $setDifference: ["$wishlist", [id]] },
      { $concatArrays: [{ $ifNull: ["$wishlist", []] }, [id]] },
    ] },
    __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
  } }], { returnDocument: "after", updatePipeline: true });
  if (!user) return res.status(404).json({ success: false, message: "Product not found" });
  const saved = user.wishlist.some(value => value.equals(id));
  return res.json({ success: true, saved, message: saved ? "Product added to wishlist" : "Product removed from wishlist" });
};
