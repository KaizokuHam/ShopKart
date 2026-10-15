export function validateRuntimeConfig(env = process.env) {
  if (!env.dbUrl || !env.jwt_secret || env.jwt_secret === "replace-with-a-long-random-secret") {
    throw new Error("Set dbUrl and a private jwt_secret in backend/.env (see .env.example)");
  }
  if (env.COOKIE_SAME_SITE && !["lax", "none"].includes(env.COOKIE_SAME_SITE)) throw new Error("COOKIE_SAME_SITE must be lax or none");
  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) throw new Error("PORT must be an integer between 1 and 65535");
  if (env.TRUST_PROXY && !/^[0-9]$/.test(env.TRUST_PROXY)) throw new Error("TRUST_PROXY must be the number of trusted proxy hops (0–9)");
  if (env.NODE_ENV !== "production") return;
  if (env.jwt_secret.length < 32) throw new Error("Production jwt_secret must contain at least 32 characters");
  const origins = (env.CLIENT_ORIGIN || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try { const parsed = new URL(origin); return parsed.protocol !== "https:" || parsed.origin !== origin; }
    catch { return true; }
  })) throw new Error("Production CLIENT_ORIGIN must contain exact HTTPS origins without paths");
  if (!env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") || env.RAZORPAY_KEY_ID.includes("replace_me") ||
      !env.RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET.startsWith("replace-")) throw new Error("Production demo checkout requires valid Razorpay Test Mode credentials");
  if (!env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET.startsWith("replace-")) throw new Error("Set RAZORPAY_WEBHOOK_SECRET before shipping checkout");
}
