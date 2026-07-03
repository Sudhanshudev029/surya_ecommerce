import api from './axios.js';

// Auth
export const authApi = {
  sendRegisterOtp: (email) => api.post('/auth/register/send-otp', { email }),
  register: (body) => api.post('/auth/register', body),
  forgotPasswordOtp: (email) => api.post('/auth/forgot-password/send-otp', { email }),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  login: (body) => api.post('/auth/login', body),
  me: () => api.get('/auth/me'),
  updateProfile: (body) => api.patch('/auth/profile', body),
  changePassword: (body) => api.post('/auth/change-password', body),
};

// Products & categories
export const productApi = {
  list: (params) => api.get('/products', { params }),
  adminList: (params) => api.get('/products/admin', { params }),
  get: (slug) => api.get(`/products/${slug}`),
  create: (body) => api.post('/products', body),
  update: (id, body) => api.patch(`/products/${id}`, body),
  remove: (id) => api.delete(`/products/${id}`),
};
export const categoryApi = {
  list: () => api.get('/categories'),
  create: (body) => api.post('/categories', body),
  update: (id, body) => api.patch(`/categories/${id}`, body),
  remove: (id) => api.delete(`/categories/${id}`),
};

// Cart
export const cartApi = {
  get: () => api.get('/cart'),
  add: (productId, quantity = 1) => api.post('/cart/items', { productId, quantity }),
  update: (id, quantity) => api.patch(`/cart/items/${id}`, { quantity }),
  remove: (id) => api.delete(`/cart/items/${id}`),
  clear: () => api.delete('/cart'),
};

// Addresses
export const addressApi = {
  list: () => api.get('/addresses'),
  create: (body) => api.post('/addresses', body),
  update: (id, body) => api.patch(`/addresses/${id}`, body),
  remove: (id) => api.delete(`/addresses/${id}`),
};

// Orders
export const orderApi = {
  place: (body) => api.post('/orders', body),
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
};

// Admin
export const adminApi = {
  overview: () => api.get('/admin/overview'),
  orders: (params) => api.get('/admin/orders', { params }),
  order: (id) => api.get(`/admin/orders/${id}`),
  updateOrderStatus: (id, status) => api.patch(`/admin/orders/${id}/status`, { status }),
  users: () => api.get('/admin/users'),
  toggleBlock: (id) => api.patch(`/admin/users/${id}/block`),
  lowStock: () => api.get('/inventory/low-stock'),
  setStock: (productId, body) => api.patch(`/inventory/${productId}`, body),
};

// Image upload (multipart → Cloudinary). Returns { url, publicId }.
export const uploadApi = {
  image: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/upload', fd); // axios sets the multipart boundary automatically
  },
};
