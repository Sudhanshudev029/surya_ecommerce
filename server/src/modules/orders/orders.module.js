import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { notifyNewOrder } from '../../services/notify.js';
import { sendOrderConfirmationEmail } from '../../services/orderEmails.js';
import { quoteDelivery } from '../../services/deliveryService.js';

const router = Router();
router.use(requireAuth);

const placeOrderSchema = z.object({
  body: z.object({
    addressId: z.string().uuid(),
    paymentMethod: z.literal('cod').default('cod'),
    notes: z.string().max(500).optional(),
  }),
});

const mapOrder = (o, items = []) => ({
  id: o.id,
  orderNumber: Number(o.order_number),
  status: o.status,
  paymentMethod: o.payment_method,
  paymentStatus: o.payment_status,
  subtotal: Number(o.subtotal),
  deliveryFee: Number(o.delivery_fee),
  total: Number(o.total),
  notes: o.notes,
  shipping: {
    recipient: o.ship_recipient, phone: o.ship_phone, line1: o.ship_line1,
    line2: o.ship_line2, city: o.ship_city, state: o.ship_state, pincode: o.ship_pincode,
  },
  createdAt: o.created_at,
  items: items.map((i) => ({
    productId: i.product_id, name: i.product_name,
    unitPrice: Number(i.unit_price), quantity: i.quantity, lineTotal: Number(i.line_total),
  })),
});

// Place a COD order from the user's cart — fully transactional.
router.post('/', validate(placeOrderSchema), asyncHandler(async (req, res) => {
  const { addressId, paymentMethod, notes } = req.body;
  const userId = req.user.id;

  const order = await withTransaction(async (client) => {
    const addr = await client.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
    if (!addr.rows[0]) throw ApiError.badRequest('Invalid delivery address');

    const cart = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (!cart.rows[0]) throw ApiError.badRequest('Cart is empty');

    // Lock the inventory rows for every cart item.
    const items = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.is_active, i.quantity AS stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN inventory i ON i.product_id = p.id
       WHERE ci.cart_id = $1
       FOR UPDATE OF i`,
      [cart.rows[0].id],
    );
    if (items.rows.length === 0) throw ApiError.badRequest('Cart is empty');

    for (const it of items.rows) {
      if (!it.is_active) throw ApiError.conflict(`${it.name} is no longer available`);
      if ((it.stock ?? 0) < it.quantity)
        throw ApiError.conflict(`Insufficient stock for ${it.name} (only ${it.stock ?? 0} left)`);
    }

    const a = addr.rows[0];
    const subtotal = items.rows.reduce((s, it) => s + Number(it.price) * it.quantity, 0);
    // Delivery fee is computed server-side from the address distance (never trust the client).
    const { deliveryFee } = await quoteDelivery(a.lat, a.lng);
    const total = subtotal + deliveryFee;

    const orderRes = await client.query(
      `INSERT INTO orders
         (user_id, payment_method, ship_recipient, ship_phone, ship_line1, ship_line2,
          ship_city, ship_state, ship_pincode, subtotal, delivery_fee, total, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [userId, paymentMethod, a.recipient, a.phone, a.line1, a.line2,
       a.city, a.state, a.pincode, subtotal, deliveryFee, total, notes || null],
    );
    const newOrder = orderRes.rows[0];

    for (const it of items.rows) {
      const lineTotal = Number(it.price) * it.quantity;
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [newOrder.id, it.product_id, it.name, it.price, it.quantity, lineTotal],
      );
      await client.query(
        'UPDATE inventory SET quantity = quantity - $2, updated_at = now() WHERE product_id = $1',
        [it.product_id, it.quantity],
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.rows[0].id]);

    const oi = await client.query('SELECT * FROM order_items WHERE order_id = $1', [newOrder.id]);
    return mapOrder(newOrder, oi.rows);
  });

  created(res, order, 'Order placed successfully');

  // Notify the store owner on Telegram + email the customer — fire-and-forget.
  notifyNewOrder(order);
  sendOrderConfirmationEmail(order, { email: req.user.email, fullName: req.user.full_name });
}));

// List my orders
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  ok(res, rows.map((o) => mapOrder(o)));
}));

// Order detail (owner only)
router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) throw ApiError.notFound('Order not found');
  const items = await query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
  ok(res, mapOrder(rows[0], items.rows));
}));

// Cancel my own order (only if still pending/confirmed) — restocks inventory.
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.user.id]);
    const order = rows[0];
    if (!order) throw ApiError.notFound('Order not found');
    if (!['pending', 'confirmed'].includes(order.status))
      throw ApiError.badRequest(`Cannot cancel an order that is ${order.status}`);

    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    for (const it of items.rows) {
      if (it.product_id) {
        await client.query(
          'UPDATE inventory SET quantity = quantity + $2 WHERE product_id = $1',
          [it.product_id, it.quantity]);
      }
    }
    const upd = await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *`,
      [order.id]);
    return mapOrder(upd.rows[0], items.rows);
  });
  ok(res, result, 'Order cancelled');
}));

export { mapOrder };
export default router;
