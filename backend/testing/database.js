import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

export async function testDatabase() {
  // Never uses dbUrl or a developer's existing MongoDB deployment.
  const replica = await MongoMemoryReplSet.create({ binary: { version: "8.2.6" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(replica.getUri(), { dbName: "shopkart-isolated-tests" });
  await Promise.all([Customer.init(), Product.init(), Order.init()]);
  return async () => { await mongoose.disconnect(); await replica.stop(); };
}
