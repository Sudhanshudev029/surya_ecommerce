import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const addSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  }),
});
const updateSchema = z.object({
  body: z.object({ quantity: z.number().int().min(1) }),
});

/** Ensure the user has a cart row, return its id. */
async function getCartId(userId) {
  const { rows } = await query('SELECT id FROM carts WHERE user_id = $1', [userId]);
  if (rows[0]) return rows[0].id;
  const created = await query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
  return created.rows[0].id;
}

async function buildCart(cartId) {
  const { rows } = await query(
    `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.slug, p.price, p.unit,
            p.image_url, i.quantity AS stock
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN inventory i ON i.product_id = p.id
     WHERE ci.cart_id = $1
     ORDER BY p.name`,
    [cartId],
  );
  const items = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    slug: r.slug,
    price: Number(r.price),
    unit: r.unit,
    imageUrl: r.image_url,
    quantity: r.quantity,
    stock: r.stock ?? 0,
    lineTotal: Number(r.price) * r.quantity,
  }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, subtotal, count: items.reduce((s, i) => s + i.quantity, 0) };
}

router.get('/', asyncHandler(async (req, res) => {
  const cartId = await getCartId(req.user.id);
  ok(res, await buildCart(cartId));
}));

router.post('/items', validate(addSchema), asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const stock = await query('SELECT quantity FROM inventory WHERE product_id = $1', [productId]);
  if (!stock.rows[0]) throw ApiError.notFound('Product not found');

  const cartId = await getCartId(req.user.id);
  await query(
    `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [cartId, productId, quantity],
  );
  ok(res, await buildCart(cartId), 'Added to cart');
}));

router.patch('/items/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  const cartId = await getCartId(req.user.id);
  const { rowCount } = await query(
    'UPDATE cart_items SET quantity = $3 WHERE id = $1 AND cart_id = $2',
    [req.params.id, cartId, req.body.quantity],
  );
  if (!rowCount) throw ApiError.notFound('Cart item not found');
  ok(res, await buildCart(cartId), 'Quantity updated');
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  const cartId = await getCartId(req.user.id);
  await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.id, cartId]);
  ok(res, await buildCart(cartId), 'Removed from cart');
}));

router.delete('/', asyncHandler(async (req, res) => {
  const cartId = await getCartId(req.user.id);
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  ok(res, await buildCart(cartId), 'Cart cleared');
}));

export { getCartId, buildCart };
export default router;
