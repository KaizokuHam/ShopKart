import Customer from "../models/customer.model.js";
import bcrypt from 'bcrypt'
import genToken from "../utils/generateToken.js";
import { isAdminEmail } from "../middleware/admin.middleware.js";


const cookieOptions = () => ({
    httpOnly: true,
    sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
})

const profile = user => ({ _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, createdAt: user.createdAt, isAdmin: isAdminEmail(user.email) });

export const registerCustomer = async (req,res)=>{
    try{
        let {fullName, email, password, phone} = req.body || {};
        if ([fullName, email, password, phone].some(value => typeof value !== "string" || !value.trim())) return res.status(400).json({message: "All fields must be non-empty strings"});
        fullName = fullName.trim(); email = email.trim().toLowerCase(); phone = phone.trim();
        if (isAdminEmail(email)) return res.status(403).json({ message: "This email is reserved. Provision the trusted account before configuring administrative access." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[0-9]{10,12}$/.test(phone.replace(/[\s-]/g, ""))) return res.status(400).json({message: "Enter a valid email and phone number"});

        if(!fullName || !email || !password || !phone) {
            return res.status(400).json({message: 'All fields required'})
        }
        if(password.length <6 ){
            return res.status(400).json({message:"Password must contain atleast 6 characters"})
        }
        if (Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ message: "Password must be at most 72 UTF-8 bytes" });

        const emailExists = await Customer.findOne({email})

        if(emailExists){
            return res.status(409).json({message: " Email already Exists"})
        }

        const salt = await bcrypt.genSalt(10)

        const hashedPassword = await bcrypt.hash(password , salt)

        const newCustomer = await Customer.create({
            fullName,
            email,
            password : hashedPassword,
            phone
        })

        return res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            customer: {
                _id: newCustomer._id,
                id: newCustomer._id,
                fullName: newCustomer.fullName,
                email: newCustomer.email,
                phone: newCustomer.phone
            }
        })
    }
    catch(error) {
        res.status(error.code === 11000 ? 409 : 500).json({message: error.code === 11000 ? 'Email already exists' : 'Unable to create account'})
    }
}




export const loginCustomer = async (req,res)=>{
    try {
        let {email , password} = req.body || {};
        if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({message: "Email and password are required"});
        if (Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ message: "Password must be at most 72 UTF-8 bytes" });
        email = email.trim().toLowerCase();

        if(!email || !password){
            return res.status(400).json({ message: 'All fields Required' })
        }

        const user = await Customer.findOne({email})

        if(!user){
           return res.status(401).json({message:"Invalid email or password"})
        }

        const passwordMatched = await bcrypt.compare(password, user.password)

        if(passwordMatched){
            const token = genToken(user._id, user.authVersion || 0)
            res.cookie('token',token, { ...cookieOptions(), maxAge: 10 * 24 * 60 * 60 * 1000 })

            return res.status(200).json({
                success: true,
                message:"Login successful",
                userData: profile(user)
            })
        }
        else{
            return res.status(401).json({message:"Invalid email or password"})
        }


    } catch (error) {
        return res.status(503).json({message:"Account service is unavailable. Please try again shortly."})
    }
}

export const logoutCustomer = (req, res) => {
    res.clearCookie("token", cookieOptions())
    res.status(200).json({ success: true, message: "Logged out successfully" })
}

export const getMe = (req,res)=>{
    res.status(200).json(profile(req.user))
}

export const getLegacyMe = (req, res) => res.json({ authenticatedUser: profile(req.user) });

export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (typeof oldPassword !== "string" || !oldPassword || typeof newPassword !== "string" || !newPassword.trim() || newPassword.length < 6 || Buffer.byteLength(newPassword, "utf8") > 72 || Buffer.byteLength(oldPassword, "utf8") > 72) {
        return res.status(400).json({ success: false, message: "Provide the current password and a new password of 6 characters to 72 UTF-8 bytes" });
    }
    const customer = await Customer.findById(req.user._id);
    if (!customer || !await bcrypt.compare(oldPassword, customer.password)) return res.status(401).json({ success: false, message: "Current password is incorrect" });
    if (oldPassword === newPassword) return res.status(400).json({ success: false, message: "Choose a different new password" });
    const updated = await Customer.findOneAndUpdate({ _id: customer._id, password: customer.password }, {
        $set: { password: await bcrypt.hash(newPassword, 10) }, $inc: { authVersion: 1, __v: 1 },
    }, { returnDocument: "after", runValidators: true });
    if (!updated) return res.status(409).json({ success: false, message: "Your password changed in another session. Please sign in again." });
    res.cookie("token", genToken(updated._id, updated.authVersion), { ...cookieOptions(), maxAge: 10 * 24 * 60 * 60 * 1000 });
    return res.json({ success: true, message: "Password changed successfully. Other sessions have been signed out." });
};
