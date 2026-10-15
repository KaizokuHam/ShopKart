import express from 'express'
import {getMe, getLegacyMe, loginCustomer, logoutCustomer, registerCustomer, changePassword} from '../controllers/customer.controller.js'
import { isAuthenticated } from '../middleware/auth.middleware.js'

export const createCustomerRoutes = ({ legacy = false } = {}) => {
const customerRoutes = express.Router()


customerRoutes.post('/register' , registerCustomer)
customerRoutes.post('/login' , loginCustomer)
customerRoutes.get('/me', isAuthenticated, legacy ? getLegacyMe : getMe)
customerRoutes.post('/logout', isAuthenticated, logoutCustomer)
customerRoutes.patch('/change-password', isAuthenticated, changePassword)
return customerRoutes;
}
export default createCustomerRoutes({ legacy: true })
