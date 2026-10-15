import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";

const population = {
  path: "cart.product", select: "name description price category image stock",
  transform: (product, id) => product || {
    _id: id, name: "Product no longer available", price: 0, stock: 0, unavailable: true,
  },
};
const respond = (res, user) => res.json({ success: true, cart: user.cart, message: "Cart updated" });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

export const getCart = async (req, res) => {
  const user = await Customer.findById(req.user._id).populate(population);
  if (!user) return fail(res, 401, "User not found");
  return res.json({ success: true, cart: user.cart });
};

const mutateCart = (action) => async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isObjectIdOrHexString(productId)) return fail(res, 400, "Invalid product ID");
    const id = new mongoose.Types.ObjectId(productId);
    const quantity = req.body?.quantity;
    if (action === "update" && (!Number.isSafeInteger(quantity) || quantity < 1)) {
      return fail(res, 400, "Quantity must be a positive whole number");
    }
    const product = action === "remove" ? null : await Product.findById(id);
    if (action !== "remove" && !product) return fail(res, 404, "Product not found");
    if (action !== "remove" && (product.stock < 1 || (action === "update" && quantity > product.stock))) {
      return fail(res, 400, "Quantity exceeds available stock");
    }
    let filter = { _id: req.user._id };
    let update;
    if (action === "add") {
      filter.cart = { $not: { $elemMatch: { product: id, quantity: { $gte: product.stock } } } };
      update = [{ $set: {
        cart: { $cond: [
          { $in: [id, { $ifNull: ["$cart.product", []] }] },
          { $map: { input: "$cart", as: "item", in: { $cond: [
            { $eq: ["$$item.product", id] },
            { $mergeObjects: ["$$item", { quantity: { $add: ["$$item.quantity", 1] } }] },
            "$$item",
          ] } } },
          { $concatArrays: [{ $ifNull: ["$cart", []] }, [{ _id: new mongoose.Types.ObjectId(), product: id, quantity: 1 }]] },
        ] },
        __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
      } }];
    } else {
      filter["cart.product"] = id;
      update = action === "remove"
        ? { $pull: { cart: { product: id } }, $inc: { __v: 1 } }
        : { $set: { "cart.$.quantity": quantity }, $inc: { __v: 1 } };
    }
    const user = await Customer.findOneAndUpdate(filter, update, { returnDocument: "after", updatePipeline: action === "add" }).populate(population);
    if (!user) return fail(res, action === "add" ? 400 : 404, action === "add" ? "Cannot add more: stock limit reached" : "Product not in cart");
    return respond(res, user);
  } catch (error) {
    console.error("Cart mutation failed:", error.message);
    return fail(res, 500, "Unable to update cart. Please try again.");
  }
};

export const addToCart = mutateCart("add");
export const updateCartQuantity = mutateCart("update");
export const removeFromCart = mutateCart("remove");
