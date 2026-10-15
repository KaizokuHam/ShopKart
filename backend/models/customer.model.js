import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema({
    fullName:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    authVersion: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    wishlist: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        }
    ],
    cart: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                default: 1,
                min: [1, "Quantity cannot be less than 1"],
                validate: Number.isSafeInteger
            }
        }
    ]
}, {
    timestamps: true,
    optimisticConcurrency: true
})

const Customer = mongoose.model('Customer',customerSchema)
export default Customer
