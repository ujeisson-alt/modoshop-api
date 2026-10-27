import { z } from 'zod';

export const salesReportSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" debe ser anterior a "to"', path: ['from'] });

export const topProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type SalesReportQuery = z.infer<typeof salesReportSchema>;
export type TopProductsQuery = z.infer<typeof topProductsSchema>;
