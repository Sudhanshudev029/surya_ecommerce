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
  // Generic message on purpose — don't reveal whether the email OR the phone
  // is the one already taken (prevents account enumeration).
  const existing = await query(
    'SELECT 1 FROM users WHERE email = $1 OR phone = $2 LIMIT 1',
    [email, phone],
  );
  if (existing.rowCount) throw ApiError.conflict('An account already exists. Please log in.');

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

export async function login({ identifier, password }) {
  // Customers log in with phone; the admin/owner may also use email.
  const id = String(identifier).trim();
  let rows;
  if (id.includes('@')) {
    ({ rows } = await query('SELECT * FROM users WHERE email = $1', [id]));
  } else {
    const digits = id.replace(/\D/g, '');
    const phone = digits.length > 10 ? digits.slice(-10) : digits;
    ({ rows } = await query('SELECT * FROM users WHERE phone = $1', [phone]));
  }
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('Invalid phone number or password');

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Invalid phone number or password');
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
