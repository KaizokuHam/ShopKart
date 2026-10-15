import axiosInstance from "../axiosCalls/axios.js";

export const registerCustomer = async fields => (await axiosInstance.post("/customers/register", fields)).data;
export const loginCustomer = async fields => (await axiosInstance.post("/customers/login", fields)).data;
export const getCurrentCustomer = async signal => (await axiosInstance.get("/customers/me", { signal })).data;
export const logoutCustomer = async () => (await axiosInstance.post("/customers/logout")).data;
export const changePassword = async fields => (await axiosInstance.patch("/customers/change-password", fields)).data;

/**
 * Product API Service
 * Separates API/network logic from UI components.
 */

export const getProducts = async ({ search, category, sort } = {}, signal) => {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (category && category.trim()) params.category = category.trim();
  if (sort && sort.trim()) params.sort = sort.trim();

  const response = await axiosInstance.get("/products", { params, signal });
  return response.data;
};

export const getProductById = async (id, signal) => {
  const response = await axiosInstance.get(`/products/${id}`, { signal });
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await axiosInstance.post("/products", productData);
  return response.data;
};

/**
 * Wishlist API Service
 */
export const getWishlist = async (signal) => {
  const response = await axiosInstance.get("/wishlist", { signal });
  return response.data;
};

export const addToWishlist = async (productId) => {
  const response = await axiosInstance.post(`/wishlist/${productId}`);
  return response.data;
};

export const removeFromWishlist = async (productId) => {
  const response = await axiosInstance.delete(`/wishlist/${productId}`);
  return response.data;
};

export const toggleWishlist = async (productId) => {
  const response = await axiosInstance.patch(`/wishlist/${productId}/toggle`);
  return response.data;
};

/**
 * Cart API Service
 */
export const getCart = async (signal) => {
  const response = await axiosInstance.get("/cart", { signal });
  return response.data;
};

export const addToCart = async (productId) => {
  const response = await axiosInstance.post(`/cart/${productId}`);
  return response.data;
};

export const updateCartQuantity = async (productId, quantity) => {
  const response = await axiosInstance.patch(`/cart/${productId}`, { quantity });
  return response.data;
};

export const removeFromCart = async (productId) => {
  const response = await axiosInstance.delete(`/cart/${productId}`);
  return response.data;
};

/**
 * Order & Checkout API Service
 */
export const createPaymentOrder = async (shippingAddress) => {
  const response = await axiosInstance.post("/orders/create-payment-order", {
    shippingAddress,
  });
  return response.data;
};

export const verifyPayment = async (verificationData) => {
  const response = await axiosInstance.post(
    "/orders/verify-payment",
    verificationData,
    { timeout: 20000 }
  );
  return response.data;
};

export const reportPaymentResult = async (id, outcome, paymentId) => {
  const response = await axiosInstance.post(`/orders/${id}/payment-result`, { outcome, paymentId }, { timeout: 10000 });
  return response.data;
};

export const getMyOrders = async (signal) => {
  const response = await axiosInstance.get("/orders", { signal });
  return response.data;
};

export const getOrderById = async (id, signal) => {
  const response = await axiosInstance.get(`/orders/${id}`, { signal });
  return response.data;
};

export const reconcileOrder = async id => {
  const response = await axiosInstance.post(`/orders/${id}/reconcile`, {}, { timeout: 20000 });
  return response.data;
};
export const retryFulfillment = async id => {
  const response = await axiosInstance.post(`/orders/${id}/retry-fulfillment`, {}, { timeout: 20000 });
  return response.data;
};

export const updateOrderStatus = async (id, status) => {
  const response = await axiosInstance.patch(`/orders/${id}/status`, { status });
  return response.data;
};

export default {
  getProducts,
  getProductById,
  createProduct,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
};
