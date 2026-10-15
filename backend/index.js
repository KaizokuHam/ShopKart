import "./config/env.js";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { validateRuntimeConfig } from "./config/runtime.js";

try {
  validateRuntimeConfig();
  mongoose.set("bufferCommands", false);
  await mongoose.connect(process.env.dbUrl, { serverSelectionTimeoutMS: 10000 });
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") throw new Error("Checkout requires a MongoDB replica set or sharded deployment; standalone MongoDB is unsupported");
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const server = createApp().listen(process.env.PORT || 8085, () => console.log(`ShopKart API listening on port ${process.env.PORT || 8085}`));
  server.on("error", async error => {
    console.error("HTTP server failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(deadline);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error("Startup failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
