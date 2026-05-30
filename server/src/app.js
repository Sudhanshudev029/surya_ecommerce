import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import productRoutes from './modules/products/products.routes.js';
import categoryRoutes from './modules/categories/categories.module.js';
import cartRoutes from './modules/cart/cart.module.js';
import addressRoutes from './modules/addresses/addresses.module.js';
import orderRoutes from './modules/orders/orders.module.js';
import inventoryRoutes from './modules/inventory/inventory.module.js';
import adminRoutes from './modules/admin/admin.module.js';
import uploadRoutes from './modules/upload/upload.module.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

// CORS: in production, only allow the configured client origin.
// In development, reflect any localhost / 127.0.0.1 origin (any port) so the
// app works whether Vite runs on :5173, :5174, etc. or you use 127.0.0.1.
const corsOrigin = isProd
  ? env.CLIENT_URL
  : (origin, cb) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    };
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

app.get('/api/health', (req, res) =>
  res.json({ success: true, status: 'ok', uptime: process.uptime() }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
