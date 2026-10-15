import "./config/env.js";
import mongoose from "mongoose";
import Product from "./models/product.model.js";

const sampleProducts = [
  {
    name: "Noise Cancelling Headphones",
    description: "Wireless over-ear headphones with active noise cancellation and 30-hour battery life.",
    price: 4999,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    stock: 25,
  },
  {
    name: "Mechanical Keyboard",
    description: "RGB mechanical keyboard with tactile blue switches and custom double-shot keycaps.",
    price: 2999,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
    stock: 10,
  },
  {
    name: "Minimalist Smart Watch",
    description: "Sleek fitness and smartwatch featuring AMOLED display, heart-rate tracking, and water resistance.",
    price: 6499,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
    stock: 14,
  },
  {
    name: "Arc Desk Lamp",
    description: "Brushed brass architectural desk lamp with adjustable arm and warm ambient LED lighting.",
    price: 3499,
    category: "Home",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
    stock: 8,
  },
  {
    name: "Sunday Ceramic Mug Set",
    description: "Handcrafted stoneware mug set of four with speckled matte glaze for daily brews.",
    price: 1299,
    category: "Home",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
    stock: 20,
  },
  {
    name: "Linen Throw Blanket",
    description: "100% pure washed linen throw blanket with fringed edges for living rooms and bedrooms.",
    price: 2199,
    category: "Home",
    image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800&auto=format&fit=crop&q=80",
    stock: 15,
  },
  {
    name: "Canvas Carry Tote",
    description: "Heavyweight 16oz organic cotton canvas tote with interior zipped pocket and reinforced handles.",
    price: 1499,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
    stock: 30,
  },
  {
    name: "Merino Wool Beanie",
    description: "Rib-knit beanie spun from extra-fine Australian merino wool for breathable warmth.",
    price: 899,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&auto=format&fit=crop&q=80",
    stock: 18,
  },
  {
    name: "The Design of Everyday Things",
    description: "Don Norman's seminal cognitive science guide to why human-centered design matters.",
    price: 799,
    category: "Books",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
    stock: 22,
  },
  {
    name: "Atomic Habits",
    description: "James Clear's practical guide on building good habits, breaking bad ones, and 1% improvements.",
    price: 699,
    category: "Books",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80",
    stock: 40,
  },
];

async function seed() {
  try {
    if (!process.env.dbUrl) throw new Error("Set dbUrl in backend/.env before seeding");
    await mongoose.connect(process.env.dbUrl, { serverSelectionTimeoutMS: 10000 });
    console.log("Connected to MongoDB for seeding...");

    const result = await Product.bulkWrite(sampleProducts.map(product => ({
      updateOne: { filter: { name: product.name }, update: { $setOnInsert: product }, upsert: true },
    })));
    console.log(`Added ${result.upsertedCount} sample products. Existing products and stock were preserved.`);
  } catch (err) {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
