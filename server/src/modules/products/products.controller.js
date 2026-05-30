import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import * as svc from './products.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listProducts(req.validatedQuery);
  ok(res, data);
});

// Admin variant includes inactive products
export const adminList = asyncHandler(async (req, res) => {
  const data = await svc.listProducts(req.validatedQuery, { includeInactive: true });
  ok(res, data);
});

export const getBySlug = asyncHandler(async (req, res) => {
  const product = await svc.getProductBySlug(req.params.slug);
  ok(res, product);
});

export const create = asyncHandler(async (req, res) => {
  const product = await svc.createProduct(req.body);
  created(res, product, 'Product created');
});

export const update = asyncHandler(async (req, res) => {
  const product = await svc.updateProduct(req.params.id, req.body);
  ok(res, product, 'Product updated');
});

export const remove = asyncHandler(async (req, res) => {
  await svc.deleteProduct(req.params.id);
  ok(res, null, 'Product deleted');
});
