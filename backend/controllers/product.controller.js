import mongoose from "mongoose";
import Product from "../models/product.model.js";

export const updateStock = async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id) || !Number.isSafeInteger(req.body?.stock) || req.body.stock < 0) {
    return res.status(400).json({ success: false, message: "A valid product ID and non-negative integer stock are required" });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, { $set: { stock: req.body.stock } }, { returnDocument: "after", runValidators: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  return res.json({ success: true, product });
};

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image, stock } = req.body || {};

    if ([name, description, category, image].some(value => typeof value !== "string" || !value.trim()) ||
        typeof price !== "number" || typeof stock !== "number") {
      return res.status(400).json({ message: "Product text fields are required; price and stock must be numbers" });
    }
    let imageUrl;
    try { imageUrl = new URL(image); } catch { /* Rejected below. */ }
    if (!imageUrl || !["https:", "http:"].includes(imageUrl.protocol)) {
      return res.status(400).json({ message: "Image must be an HTTP or HTTPS URL" });
    }

    if (
      !name ||
      !description ||
      !category ||
      !image ||
      price === undefined ||
      price === null ||
      stock === undefined ||
      stock === null
    ) {
      return res.status(400).json({ message: "Missing required product fields" });
    }

    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      return res.status(400).json({ message: "Invalid price: Price must be greater than 0" });
    }
    if (!Number.isSafeInteger(Math.round(numPrice * 100)) || Math.abs(numPrice * 100 - Math.round(numPrice * 100)) > 0.000001) {
      return res.status(400).json({ message: "Price must have at most two decimal places" });
    }

    const numStock = Number(stock);
    if (!Number.isSafeInteger(numStock) || numStock < 0) {
      return res.status(400).json({ message: "Invalid stock: Stock cannot be negative" });
    }

    const product = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: numPrice,
      category: String(category).trim(),
      image: String(image).trim(),
      stock: numStock,
    });

    return res.status(201).json(product);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    if ([search, category, sort].some(value => value !== undefined && typeof value !== "string")) {
      return res.status(400).json({ success: false, message: "Search, category and sort must be strings" });
    }

    const query = {};

    if (search && search.trim() !== "") {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    if (category && category.trim() !== "") {
      const escapedCategory = category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.category = {
        $regex: `^${escapedCategory}$`,
        $options: "i",
      };
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "price_asc") {
      sortOptions = { price: 1 };
    } else if (sort === "price_desc") {
      sortOptions = { price: -1 };
    }

    const products = await Product.find(query).sort(sortOptions);

    return res.status(200).json({
      success: true,
      count: products.length,
      products: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json(product);
  } catch (error) {
    return res.status(400).json({
      message: "Invalid product ID",
    });
  }
};
