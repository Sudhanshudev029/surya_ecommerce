import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const addressSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(40),
    recipient: z.string().min(2).max(120),
    phone: z.string().min(7).max(20),
    line1: z.string().min(3).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(2).max(80),
    state: z.string().min(1).max(80),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
    isDefault: z.boolean().optional(),
    lat: z.coerce.number().min(-90).max(90).nullable().optional(),
    lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  }),
});

const mapAddr = (r) => ({
  id: r.id, label: r.label, recipient: r.recipient, phone: r.phone,
  line1: r.line1, line2: r.line2, city: r.city, state: r.state,
  pincode: r.pincode, isDefault: r.is_default, lat: r.lat, lng: r.lng,
});

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
    [req.user.id],
  );
  ok(res, rows.map(mapAddr));
}));

router.post('/', validate(addressSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const row = await withTransaction(async (client) => {
    if (b.isDefault) {
      await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
    }
    const { rows } = await client.query(
      `INSERT INTO addresses (user_id, label, recipient, phone, line1, line2, city, state, pincode, is_default, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, b.label || null, b.recipient, b.phone, b.line1, b.line2 || null,
       b.city, b.state || null, b.pincode, b.isDefault ?? false, b.lat ?? null, b.lng ?? null],
    );
    return rows[0];
  });
  created(res, mapAddr(row), 'Address added');
}));

router.patch('/:id', validate(addressSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const row = await withTransaction(async (client) => {
    if (b.isDefault) {
      await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
    }
    const { rows } = await client.query(
      `UPDATE addresses SET label=$3, recipient=$4, phone=$5, line1=$6, line2=$7,
         city=$8, state=$9, pincode=$10, is_default=$11, lat=$12, lng=$13
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, b.label || null, b.recipient, b.phone, b.line1,
       b.line2 || null, b.city, b.state || null, b.pincode, b.isDefault ?? false, b.lat ?? null, b.lng ?? null],
    );
    if (!rows[0]) throw ApiError.notFound('Address not found');
    return rows[0];
  });
  ok(res, mapAddr(row), 'Address updated');
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  ok(res, null, 'Address deleted');
}));

export default router;
