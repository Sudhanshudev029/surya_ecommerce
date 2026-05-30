import { ApiError } from '../utils/ApiError.js';

/** Allow only the given roles. Use after requireAuth. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Admin access required'));
  next();
};

export const requireAdmin = requireRole('admin', 'superadmin');
