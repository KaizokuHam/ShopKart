import express from 'express'
import { createProduct, getProductById, getProducts, updateStock } from '../controllers/product.controller.js'
import { isAuthenticated } from '../middleware/auth.middleware.js'
import { requireAdmin } from '../middleware/admin.middleware.js'


const productRoutes = express.Router()

productRoutes.post('/', isAuthenticated, requireAdmin, createProduct)
productRoutes.patch('/:id/stock', isAuthenticated, requireAdmin, updateStock)
productRoutes.get('/', getProducts)
productRoutes.get('/:id',getProductById)
export default productRoutes
