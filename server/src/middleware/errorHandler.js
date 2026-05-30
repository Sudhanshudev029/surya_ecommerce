import { isProd } from '../config/env.js';

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Postgres unique violation → 409
  if (err.code === '23505') {
    status = 409;
    message = 'A record with these details already exists';
  }
  // Postgres FK violation → 400
  if (err.code === '23503') {
    status = 400;
    message = 'Related record not found';
  }

  if (status >= 500) console.error('💥', err);

  const payload = { success: false, message };
  if (err.details) payload.errors = err.details;
  if (!isProd && status >= 500) payload.stack = err.stack;

  res.status(status).json(payload);
};
