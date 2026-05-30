import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';
import { slugify } from '../utils/slugify.js';

// Production-safe seed: creates the admin user, and seeds a few default
// categories ONLY if the categories table is empty (so deleting a category
// in the UI won't make it reappear on the next deploy). No sample products.
const DEFAULT_CATEGORIES = [
  { name: 'Cooking Oil', img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400' },
  { name: 'Vegetables', img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400' },
  { name: 'Snacks & Biscuits', img: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400' },
  { name: 'Household', img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400' },
  { name: 'Groceries', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400' },
  { name: 'Dairy', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400' },
  { name: 'Beverages', img: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=400' },
];

async function seedDefaults() {
  console.log('⏳ Ensuring admin user...');
  const hash = await hashPassword(env.ADMIN_PASSWORD);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ('Store Admin', $1, $2, 'superadmin')
     ON CONFLICT (email) DO UPDATE
       SET role = 'superadmin', password_hash = EXCLUDED.password_hash`,
    [env.ADMIN_EMAIL, hash],
  );
  console.log(`✅ Admin ready: ${env.ADMIN_EMAIL}`);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM categories');
  if (rows[0].c === 0) {
    console.log('⏳ No categories found — seeding defaults...');
    for (const c of DEFAULT_CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (name, slug, image_url) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [c.name, slugify(c.name), c.img],
      );
    }
    console.log(`✅ Seeded ${DEFAULT_CATEGORIES.length} default categories.`);
  } else {
    console.log(`ℹ️  ${rows[0].c} categories already exist — leaving them untouched.`);
  }

  await pool.end();
}

seedDefaults().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
