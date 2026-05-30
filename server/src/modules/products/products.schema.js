import { z } from 'zod';

export const listProductsSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category: z.string().trim().optional(),       // category slug
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'name_asc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
    featured: z.coerce.boolean().optional(),
  }),
});

// Empty-string optional fields become undefined (the form may send "").
const optionalText = (max) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().max(max).optional());
const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional());

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160),
    categoryId: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    description: optionalText(2000),
    price: z.coerce.number().nonnegative(),
    mrp: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().nonnegative().optional()),
    unit: optionalText(30),
    imageUrl: optionalUrl,
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    quantity: z.coerce.number().int().min(0).default(0),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160).optional(),
    categoryId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
    description: optionalText(2000),
    price: z.coerce.number().nonnegative().optional(),
    mrp: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().nonnegative().optional()),
    unit: optionalText(30),
    imageUrl: optionalUrl,
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    quantity: z.coerce.number().int().min(0).optional(),
  }),
});
