import { z } from 'zod';
import { paginationSchema } from './common.schema';

const variantSchema = z.object({
  size: z.string().trim().max(20).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  sku: z.string().trim().min(3).max(80),
  priceModifier: z.number().min(-999999).max(999999).default(0),
  initialStock: z.number().int().min(0).default(0),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  basePrice: z.number().positive('El precio debe ser mayor a 0'),
  categoryId: z.number().int().positive().nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  imagesJson: z.array(z.url('Cada imagen debe ser una URL válida')).max(10).optional(),
  variants: z.array(variantSchema).min(1, 'El producto debe tener al menos una variante'),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    basePrice: z.number().positive().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    brand: z.string().trim().max(100).nullable().optional(),
    imagesJson: z.array(z.url()).max(10).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Enviá al menos un campo para actualizar' });

export const listProductsSchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(120).optional(), // id o slug
    brand: z.string().trim().min(1).max(100).optional(),
    size: z.string().trim().min(1).max(20).optional(),
    color: z.string().trim().min(1).max(50).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice no puede ser mayor que maxPrice',
    path: ['minPrice'],
  });

export const adjustStockSchema = z
  .object({
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(0).optional(), // valor absoluto
    delta: z.number().int().optional(), // ajuste relativo (+ entrada / - salida)
    reason: z.string().trim().max(200).optional(),
  })
  .refine((d) => (d.quantity === undefined) !== (d.delta === undefined), {
    message: 'Enviá "quantity" (valor absoluto) o "delta" (ajuste relativo), pero no ambos',
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
