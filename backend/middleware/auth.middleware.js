import jwt from 'jsonwebtoken'
import Customer from '../models/customer.model.js';

export const isAuthenticated = async (req, res, next) => {
    try {
        let token = req.cookies?.token;

        if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Token missing or not provided" });
        }

        let decoded;
        try { decoded = jwt.verify(token, process.env.jwt_secret, { algorithms: ["HS256"] }); }
        catch { return res.status(401).json({ success: false, message: "Session expired. Please sign in again." }); }

        const customer = await Customer.findById(decoded.userId).select("-password");
        if (!customer) {
            return res.status(401).json({ success: false, message: "User not found" });
        }
        if ((decoded.authVersion || 0) !== (customer.authVersion || 0)) return res.status(401).json({ success: false, message: "Your password changed. Please sign in again." });

        req.user = customer;
        next();
    } catch (error) {
        return res.status(503).json({ success: false, message: "Account service is unavailable. Please try again shortly." });
    }
};
