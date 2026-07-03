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
    ratePerKm: z.coerce.number().min(0).max(1000),
    freeWithinKm: z.coerce.number().min(0).max(1000),
    storeAddress: z.string().max(300).optional(),
    storeLat: z.coerce.number().min(-90).max(90).nullable().optional(),
    storeLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  }),
});

router.put('/settings', requireAdmin, validate(settingsSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE delivery_settings SET
       rate_per_km    = $1,
       free_within_km = $2,
       store_address  = COALESCE($3, store_address),
       store_lat      = COALESCE($4, store_lat),
       store_lng      = COALESCE($5, store_lng),
       updated_at     = now()
     WHERE id = 1 RETURNING *`,
    [b.ratePerKm, b.freeWithinKm, b.storeAddress ?? null, b.storeLat ?? null, b.storeLng ?? null],
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
  ok(res, await quoteDelivery(rows[0].lat, rows[0].lng));
}));

export default router;
