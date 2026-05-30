import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { slugify } from '../../utils/slugify.js';

const SORT_SQL = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  name_asc: 'p.name ASC',
};

const mapProduct = (r) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  price: Number(r.price),
  mrp: r.mrp != null ? Number(r.mrp) : null,
  unit: r.unit,
  imageUrl: r.image_url,
  isFeatured: r.is_featured,
  isActive: r.is_active,
  category: r.category_name ? { id: r.category_id, name: r.category_name, slug: r.category_slug } : null,
  stock: r.quantity ?? 0,
  inStock: (r.quantity ?? 0) > 0,
});

export async function listProducts(q, { includeInactive = false } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push('p.is_active = TRUE');
  if (q.search) { params.push(`%${q.search}%`); where.push(`p.name ILIKE $${params.length}`); }
  if (q.category) { params.push(q.category); where.push(`c.slug = $${params.length}`); }
  if (q.featured) where.push('p.is_featured = TRUE');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORT_SQL[q.sort] || SORT_SQL.newest;
  const offset = (q.page - 1) * q.limit;

  params.push(q.limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, i.quantity
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const { rows: cnt } = await query(
    `SELECT COUNT(*)::int AS total
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}`,
    countParams,
  );
  const total = cnt[0].total;

  return {
    items: rows.map(mapProduct),
    page: q.page,
    limit: q.limit,
    total,
    totalPages: Math.ceil(total / q.limit) || 1,
  };
}

export async function getProductBySlug(slug) {
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, i.quantity
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE p.slug = $1`,
    [slug],
  );
  if (!rows[0]) throw ApiError.notFound('Product not found');
  return mapProduct(rows[0]);
}

export async function createProduct(input) {
  const slug = `${slugify(input.name)}-${Date.now().toString(36)}`;
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO products (category_id, name, slug, description, price, mrp, unit, image_url, is_featured, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [input.categoryId || null, input.name, slug, input.description || null,
       input.price, input.mrp ?? null, input.unit || null, input.imageUrl || null,
       input.isFeatured ?? false, input.isActive ?? true],
    );
    await client.query(
      `INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)`,
      [rows[0].id, input.quantity ?? 0],
    );
    return mapProduct({ ...rows[0], quantity: input.quantity ?? 0 });
  });
}

export async function updateProduct(id, input) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!rows[0]) throw ApiError.notFound('Product not found');

    const updated = await client.query(
      `UPDATE products SET
         name        = COALESCE($2, name),
         category_id = $3,
         description = COALESCE($4, description),
         price       = COALESCE($5, price),
         mrp         = COALESCE($6, mrp),
         unit        = COALESCE($7, unit),
         image_url   = COALESCE($8, image_url),
         is_featured = COALESCE($9, is_featured),
         is_active   = COALESCE($10, is_active),
         updated_at  = now()
       WHERE id = $1 RETURNING *`,
      [id, input.name ?? null,
       input.categoryId === undefined ? rows[0].category_id : input.categoryId,
       input.description ?? null, input.price ?? null, input.mrp ?? null,
       input.unit ?? null, input.imageUrl ?? null,
       input.isFeatured ?? null, input.isActive ?? null],
    );

    if (input.quantity !== undefined) {
      await client.query(
        `INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)
         ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
        [id, input.quantity],
      );
    }
    const { rows: inv } = await client.query('SELECT quantity FROM inventory WHERE product_id = $1', [id]);
    return mapProduct({ ...updated.rows[0], quantity: inv[0]?.quantity ?? 0 });
  });
}

export async function deleteProduct(id) {
  // Hard delete. Safe for order history: order_items snapshots name/price and
  // its product_id FK is ON DELETE SET NULL, so past orders are preserved.
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
  if (!rowCount) throw ApiError.notFound('Product not found');
}
