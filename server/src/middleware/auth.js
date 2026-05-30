import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';

/** Require a valid Bearer token. Loads a fresh user row onto req.user. */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing access token');

    const payload = verifyToken(token);
    const { rows } = await query(
      'SELECT id, full_name, email, phone, role, is_blocked FROM users WHERE id = $1',
      [payload.sub],
    );
    const user = rows[0];
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (user.is_blocked) throw ApiError.forbidden('Your account has been blocked');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Invalid or expired token'));
    }
    next(err);
  }
}
