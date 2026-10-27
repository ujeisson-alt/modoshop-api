import { z } from 'zod';

export const addToCartSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, 'La cantidad no puede ser negativa').max(50),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
