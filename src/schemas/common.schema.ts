import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('El id debe ser un entero positivo'),
});

export const variantIdParamSchema = z.object({
  variantId: z.coerce.number().int().positive('El variantId debe ser un entero positivo'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type VariantIdParam = z.infer<typeof variantIdParamSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
