import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { getDeliverySettings, quoteDelivery } from '../../services/deliveryService.js';

const router = Router();
router.use(requireAuth);

const mapSettings = (s) => ({
  ratePerKm: Number(s.rate_per_km),
  freeWithinKm: Number(s.free_within_km),
  freeAboveAmount: Number(s.free_above_amount || 0),
  freeTiers: (Array.isArray(s.free_tiers) ? s.free_tiers : [])
    .map((t) => ({ km: Number(t.km), minAmount: Number(t.minAmount) })),
  storeAddress: s.store_address || '',
  storeLat: s.store_lat != null ? Number(s.store_lat) : null,
  storeLng: s.store_lng != null ? Number(s.store_lng) : null,
});

// ── Admin: read / update delivery settings ──
router.get('/settings', requireAdmin, asyncHandler(async (req, res) => {
  ok(res, mapSettings(await getDeliverySettings()));
}));

const settingsSchema = z.object({
  body: z.object({
    ratePerKm: z.coerce.number().min(0).max(100000),
    freeWithinKm: z.coerce.number().min(0).max(10000),
    freeAboveAmount: z.coerce.number().min(0).max(10000000),
    freeTiers: z.array(z.object({
      km: z.coerce.number().min(0.1).max(10000),
      minAmount: z.coerce.number().min(0).max(10000000),
    })).max(20).optional().default([]),
    storeAddress: z.string().max(300).optional(),
    storeLat: z.coerce.number().min(-90).max(90).nullable().optional(),
    storeLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  }),
});

router.put('/settings', requireAdmin, validate(settingsSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE delivery_settings SET
       rate_per_km       = $1,
       free_within_km    = $2,
       free_above_amount = $3,
       free_tiers        = $4::jsonb,
       store_address     = COALESCE($5, store_address),
       store_lat         = COALESCE($6, store_lat),
       store_lng         = COALESCE($7, store_lng),
       updated_at        = now()
     WHERE id = 1 RETURNING *`,
    [b.ratePerKm, b.freeWithinKm, b.freeAboveAmount, JSON.stringify(b.freeTiers ?? []),
     b.storeAddress ?? null, b.storeLat ?? null, b.storeLng ?? null],
  );
  ok(res, mapSettings(rows[0]), 'Delivery settings saved');
}));

// ── Customer: quote the delivery fee for one of their addresses ──
const quoteSchema = z.object({ body: z.object({ addressId: z.string().uuid() }) });

router.post('/quote', validate(quoteSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT lat, lng FROM addresses WHERE id = $1 AND user_id = $2',
    [req.body.addressId, req.user.id],
  );
  if (!rows[0]) throw ApiError.badRequest('Address not found');
  // Compute the cart subtotal server-side (drives the free-delivery rules).
  const sub = await query(
    `SELECT COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal
     FROM carts c JOIN cart_items ci ON ci.cart_id = c.id JOIN products p ON p.id = ci.product_id
     WHERE c.user_id = $1`,
    [req.user.id],
  );
  ok(res, await quoteDelivery(rows[0].lat, rows[0].lng, Number(sub.rows[0].subtotal)));
}));

export default router;
