import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';

const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
});

export async function register({ fullName, email, phone, password }) {
  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount) throw ApiError.conflict('Email already registered');

  const passwordHash = await hashPassword(password);

  const user = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [fullName, email, phone || null, passwordHash],
    );
    // every user gets a cart
    await client.query('INSERT INTO carts (user_id) VALUES ($1)', [rows[0].id]);
    return rows[0];
  });

  return { user: publicUser(user), token: signToken({ sub: user.id, role: user.role }) };
}

export async function login({ email, password }) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');
  if (user.is_blocked) throw ApiError.forbidden('Your account has been blocked');

  return { user: publicUser(user), token: signToken({ sub: user.id, role: user.role }) };
}

export async function updateProfile(userId, { fullName, phone }) {
  const { rows } = await query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone     = COALESCE($3, phone),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [userId, fullName ?? null, phone ?? null],
  );
  return publicUser(rows[0]);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const valid = await comparePassword(currentPassword, rows[0].password_hash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');
  const hash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [userId, hash]);
}

export { publicUser };
