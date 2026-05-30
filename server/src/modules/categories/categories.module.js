import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { slugify } from '../../utils/slugify.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';

const upsertSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    imageUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  }),
});

const router = Router();

// Public: list categories
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, c.image_url, c.is_active,
            COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active
     WHERE c.is_active
     GROUP BY c.id
     ORDER BY c.name`,
  );
  ok(res, rows);
}));

// Admin: create
router.post('/', requireAuth, requireAdmin, validate(upsertSchema), asyncHandler(async (req, res) => {
  const { name, imageUrl } = req.body;
  const { rows } = await query(
    `INSERT INTO categories (name, slug, image_url) VALUES ($1, $2, $3) RETURNING *`,
    [name, slugify(name), imageUrl || null],
  );
  created(res, rows[0], 'Category created');
}));

// Admin: update
router.patch('/:id', requireAuth, requireAdmin, validate(upsertSchema), asyncHandler(async (req, res) => {
  const { name, imageUrl, isActive } = req.body;
  const { rows } = await query(
    `UPDATE categories SET
       name = $2, slug = $3,
       image_url = COALESCE($4, image_url),
       is_active = COALESCE($5, is_active)
     WHERE id = $1 RETURNING *`,
    [req.params.id, name, slugify(name), imageUrl ?? null, isActive ?? null],
  );
  if (!rows[0]) throw ApiError.notFound('Category not found');
  ok(res, rows[0], 'Category updated');
}));

// Admin: delete
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  ok(res, null, 'Category deleted');
}));

export default router;
