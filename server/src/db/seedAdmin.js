import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';

// Production-safe seed: creates ONLY the admin user (no sample catalog).
// Idempotent — safe to run on every deploy.
async function seedAdmin() {
  console.log('⏳ Ensuring admin user exists...');
  const hash = await hashPassword(env.ADMIN_PASSWORD);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ('Store Admin', $1, $2, 'superadmin')
     ON CONFLICT (email) DO UPDATE
       SET role = 'superadmin', password_hash = EXCLUDED.password_hash`,
    [env.ADMIN_EMAIL, hash],
  );
  console.log(`✅ Admin ready: ${env.ADMIN_EMAIL}`);
  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('❌ Admin seed failed:', err.message);
  process.exit(1);
});
