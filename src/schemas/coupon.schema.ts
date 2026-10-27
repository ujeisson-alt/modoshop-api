import { z } from 'zod';

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, 'Solo letras, números, guiones y guión bajo')
      .toUpperCase(),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number().positive('El valor debe ser mayor a 0'),
    minOrderAmount: z.number().min(0).default(0),
    maxUses: z.number().int().positive().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((c) => c.type !== 'PERCENTAGE' || c.value <= 100, {
    message: 'Un cupón porcentual no puede superar el 100 %',
    path: ['value'],
  })
  .refine((c) => !c.expiresAt || c.expiresAt.getTime() > Date.now(), {
    message: 'La fecha de vencimiento debe ser futura',
    path: ['expiresAt'],
  });

export const listCouponsSchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type ListCouponsQuery = z.infer<typeof listCouponsSchema>;
