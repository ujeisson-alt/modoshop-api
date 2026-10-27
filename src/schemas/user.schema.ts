import { z } from 'zod';
import { paginationSchema } from './common.schema';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número')
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Enviá al menos un campo para actualizar' });

export const listUsersSchema = paginationSchema.extend({
  role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
