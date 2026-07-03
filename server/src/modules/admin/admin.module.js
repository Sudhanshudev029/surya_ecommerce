import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { mapOrder } from '../orders/orders.module.js';
import { sendOrderStatusEmail } from '../../services/orderEmails.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Allowed status transitions (server-enforced).
const NEXT = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// ── Dashboard overview ────────────────────────────────
router.get('/overview', asyncHandler(async (req, res) => {
  const [orders, users, products, revenue, recent, lowStock] = await Promise.all([
    query('SELECT COUNT(*)::int AS c FROM orders'),
    query(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'customer'`),
    query('SELECT COUNT(*)::int AS c FROM products WHERE is_active'),
    query(`SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status = 'delivered'`),
    query(`SELECT o.id, o.order_number, o.status, o.total, o.created_at, u.full_name
           FROM orders o JOIN users u ON u.id = o.user_id
           ORDER BY o.created_at DESC LIMIT 8`),
    query(`SELECT COUNT(*)::int AS c FROM inventory i JOIN products p ON p.id = i.product_id
           WHERE p.is_active AND i.quantity <= i.low_stock_threshold`),
  ]);

  // status breakdown
  const breakdown = await query('SELECT status, COUNT(*)::int AS c FROM orders GROUP BY status');

  ok(res, {
    totalOrders: orders.rows[0].c,
    totalCustomers: users.rows[0].c,
    totalProducts: products.rows[0].c,
    revenue: Number(revenue.rows[0].s),
    lowStockCount: lowStock.rows[0].c,
    statusBreakdown: breakdown.rows.reduce((acc, r) => ({ ...acc, [r.status]: r.c }), {}),
    recentOrders: recent.rows.map((r) => ({
      id: r.id, orderNumber: Number(r.order_number), status: r.status,
      total: Number(r.total), customer: r.full_name, createdAt: r.created_at,
    })),
  });
}));

// ── Orders management ─────────────────────────────────
router.get('/orders', asyncHandler(async (req, res) => {
  const status = req.query.status;
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  // Build WHERE conditions dynamically (status + customer name/email search).
  const conds = [];
  const params = [];
  if (status) { params.push(status); conds.push(`o.status::text = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const listParams = [...params, limit, offset];
  const { rows } = await query(
    `SELECT o.*, u.full_name, u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const cnt = await query(
    `SELECT COUNT(*)::int AS total
     FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}`,
    params,
  );

  ok(res, {
    items: rows.map((o) => ({ ...mapOrder(o), customer: { name: o.full_name, email: o.email } })),
    page, limit, total: cnt.rows[0].total, totalPages: Math.ceil(cnt.rows[0].total / limit) || 1,
  });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, u.full_name, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
    [req.params.id]);
  if (!rows[0]) throw ApiError.notFound('Order not found');
  const items = await query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
  ok(res, { ...mapOrder(rows[0], items.rows), customer: { name: rows[0].full_name, email: rows[0].email } });
}));

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  }),
});

router.patch('/orders/:id/status', validate(statusSchema), asyncHandler(async (req, res) => {
  const next = req.body.status;
  const { order: result, changed } = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const order = rows[0];
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status === next) return { order, changed: false };
    if (!NEXT[order.status].includes(next))
      throw ApiError.badRequest(`Cannot change status from ${order.status} to ${next}`);

    // Restock when an admin cancels.
    if (next === 'cancelled') {
      const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      for (const it of items.rows) {
        if (it.product_id) {
          await client.query('UPDATE inventory SET quantity = quantity + $2 WHERE product_id = $1',
            [it.product_id, it.quantity]);
        }
      }
    }
    const upd = await client.query(
      `UPDATE orders SET status = $2::order_status,
         payment_status = CASE WHEN $2 = 'delivered' THEN 'paid' ELSE payment_status END,
         updated_at = now() WHERE id = $1 RETURNING *`,
      [order.id, next]);
    return { order: upd.rows[0], changed: true };
  });
  ok(res, mapOrder(result), 'Order status updated');

  // Email the customer about the status change — fire-and-forget, after the response.
  if (changed) {
    query('SELECT email, full_name FROM users WHERE id = $1', [result.user_id])
      .then(({ rows }) => {
        if (rows[0]?.email) {
          sendOrderStatusEmail(mapOrder(result), { email: rows[0].email, fullName: rows[0].full_name });
        }
      })
      .catch(() => {});
  }
}));

// ── User management ───────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_blocked, u.created_at,
            COUNT(o.id)::int AS order_count
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     GROUP BY u.id ORDER BY u.created_at DESC`,
  );
  ok(res, rows.map((u) => ({
    id: u.id, fullName: u.full_name, email: u.email, phone: u.phone,
    role: u.role, isBlocked: u.is_blocked, orderCount: u.order_count, createdAt: u.created_at,
  })));
}));

router.patch('/users/:id/block', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE users SET is_blocked = NOT is_blocked, updated_at = now()
     WHERE id = $1 AND role = 'customer' RETURNING id, is_blocked`,
    [req.params.id]);
  if (!rows[0]) throw ApiError.notFound('Customer not found');
  ok(res, { id: rows[0].id, isBlocked: rows[0].is_blocked },
     rows[0].is_blocked ? 'User blocked' : 'User unblocked');
}));

router.get('/users/:id/orders', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.id]);
  ok(res, rows.map((o) => mapOrder(o)));
}));

export default router;
