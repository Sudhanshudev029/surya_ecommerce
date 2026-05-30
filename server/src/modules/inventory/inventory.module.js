import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const setStockSchema = z.object({
  body: z.object({
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0).optional(),
  }),
});

// Low-stock alerts
router.get('/low-stock', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.unit, i.quantity, i.low_stock_threshold
     FROM inventory i JOIN products p ON p.id = i.product_id
     WHERE p.is_active AND i.quantity <= i.low_stock_threshold
     ORDER BY i.quantity ASC`,
  );
  ok(res, rows.map((r) => ({
    productId: r.id, name: r.name, unit: r.unit,
    quantity: r.quantity, lowStockThreshold: r.low_stock_threshold,
  })));
}));

// Set stock for a product
router.patch('/:productId', validate(setStockSchema), asyncHandler(async (req, res) => {
  const { quantity, lowStockThreshold } = req.body;
  const { rows } = await query(
    `INSERT INTO inventory (product_id, quantity, low_stock_threshold)
     VALUES ($1, $2, COALESCE($3, 5))
     ON CONFLICT (product_id) DO UPDATE
       SET quantity = EXCLUDED.quantity,
           low_stock_threshold = COALESCE($3, inventory.low_stock_threshold),
           updated_at = now()
     RETURNING *`,
    [req.params.productId, quantity, lowStockThreshold ?? null],
  );
  if (!rows[0]) throw ApiError.notFound('Product not found');
  ok(res, { productId: rows[0].product_id, quantity: rows[0].quantity }, 'Stock updated');
}));

export default router;
