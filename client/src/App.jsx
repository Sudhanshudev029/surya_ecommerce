import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadMe } from './features/auth/authSlice.js';
import { fetchCart, resetCart } from './features/cart/cartSlice.js';

import StoreLayout from './layouts/StoreLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import { ProtectedRoute, AdminRoute } from './routes/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import ProductDetails from './pages/ProductDetails.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import NotFound from './pages/NotFound.jsx';

import Account from './pages/account/Account.jsx';
import MyOrders from './pages/account/MyOrders.jsx';
import OrderDetail from './pages/account/OrderDetail.jsx';
import Addresses from './pages/account/Addresses.jsx';

import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminInventory from './pages/admin/AdminInventory.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  // On boot, if a token exists verify it & load the user.
  useEffect(() => {
    if (localStorage.getItem('token')) dispatch(loadMe());
  }, [dispatch]);

  // Keep the server cart in sync with auth state.
  useEffect(() => {
    if (user) dispatch(fetchCart());
    else dispatch(resetCart());
  }, [user, dispatch]);

  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="product/:slug" element={<ProductDetails />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-success/:id" element={<OrderSuccess />} />
          <Route path="account" element={<Account />} />
          <Route path="account/orders" element={<MyOrders />} />
          <Route path="account/orders/:id" element={<OrderDetail />} />
          <Route path="account/addresses" element={<Addresses />} />
        </Route>
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
