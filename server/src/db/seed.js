import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';
import { slugify } from '../utils/slugify.js';

const CATEGORIES = [
  { name: 'Cooking Oil', img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400' },
  { name: 'Vegetables', img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400' },
  { name: 'Snacks & Biscuits', img: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400' },
  { name: 'Household', img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400' },
  { name: 'Groceries', img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400' },
];

// [name, categoryName, price, mrp, unit, qty, featured]
const PRODUCTS = [
  ['Fortune Sunflower Oil', 'Cooking Oil', 145, 165, '1 L', 40, true],
  ['Saffola Gold Oil', 'Cooking Oil', 180, 199, '1 L', 25, false],
  ['Fresh Tomatoes', 'Vegetables', 30, 40, '1 kg', 60, true],
  ['Onions', 'Vegetables', 28, 35, '1 kg', 80, false],
  ['Potatoes', 'Vegetables', 25, 30, '1 kg', 100, false],
  ['Parle-G Biscuits', 'Snacks & Biscuits', 10, 10, 'pack of 1', 200, true],
  ['Lays Classic Chips', 'Snacks & Biscuits', 20, 20, '52 g', 150, false],
  ['Good Day Cashew', 'Snacks & Biscuits', 30, 35, '100 g', 90, false],
  ['Surf Excel Detergent', 'Household', 110, 125, '1 kg', 35, true],
  ['Lifebuoy Soap', 'Household', 32, 38, 'pack of 3', 70, false],
  ['Vim Dishwash Bar', 'Household', 20, 25, '300 g', 120, false],
  ['Aashirvaad Atta', 'Groceries', 240, 270, '5 kg', 30, true],
  ['Tata Salt', 'Groceries', 28, 30, '1 kg', 110, false],
  ['Sugar', 'Groceries', 45, 50, '1 kg', 95, false],
  ['Toor Dal', 'Groceries', 130, 145, '1 kg', 50, false],
];

async function seed() {
  console.log('⏳ Seeding...');

  // Admin user
  const adminHash = await hashPassword(env.ADMIN_PASSWORD);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ('Store Admin', $1, $2, 'superadmin')
     ON CONFLICT (email) DO UPDATE SET role = 'superadmin', password_hash = EXCLUDED.password_hash`,
    [env.ADMIN_EMAIL, adminHash],
  );
  console.log(`   👤 admin: ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`);

  // Categories
  const catIdByName = {};
  for (const c of CATEGORIES) {
    const { rows } = await pool.query(
      `INSERT INTO categories (name, slug, image_url) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url
       RETURNING id`,
      [c.name, slugify(c.name), c.img],
    );
    catIdByName[c.name] = rows[0].id;
  }
  console.log(`   📁 ${CATEGORIES.length} categories`);

  // Products + inventory
  const imgFor = (name) =>
    `https://placehold.co/600x600/16a34a/ffffff?text=${encodeURIComponent(name.split(' ')[0])}`;
  for (const [name, cat, price, mrp, unit, qty, featured] of PRODUCTS) {
    const { rows } = await pool.query(
      `INSERT INTO products (category_id, name, slug, description, price, mrp, unit, image_url, is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET price = EXCLUDED.price, mrp = EXCLUDED.mrp
       RETURNING id`,
      [catIdByName[cat], name, slugify(name), `${name} — fresh daily-use ${cat.toLowerCase()}.`,
       price, mrp, unit, imgFor(name), featured],
    );
    await pool.query(
      `INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)
       ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [rows[0].id, qty],
    );
  }
  console.log(`   📦 ${PRODUCTS.length} products`);

  console.log('✅ Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
