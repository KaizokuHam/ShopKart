export const isAdminEmail = email => typeof email === "string" &&
  (process.env.ADMIN_EMAILS || "").split(",").some(value => value.trim() && value.trim().toLowerCase() === email.toLowerCase());

export const requireAdmin = (req, res, next) => {
  if (!isAdminEmail(req.user?.email)) return res.status(403).json({ success: false, message: "Administrator access required" });
  next();
};
