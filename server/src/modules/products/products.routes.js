import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import * as ctrl from './products.controller.js';
import { listProductsSchema, createProductSchema, updateProductSchema } from './products.schema.js';

const router = Router();

// Public
router.get('/', validate(listProductsSchema), ctrl.list);

// Admin list (must be before /:slug to avoid capture)
router.get('/admin', requireAuth, requireAdmin, validate(listProductsSchema), ctrl.adminList);

router.get('/:slug', ctrl.getBySlug);

// Admin write
router.post('/', requireAuth, requireAdmin, validate(createProductSchema), ctrl.create);
router.patch('/:id', requireAuth, requireAdmin, validate(updateProductSchema), ctrl.update);
router.delete('/:id', requireAuth, requireAdmin, ctrl.remove);

export default router;
