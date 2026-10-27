import { z } from 'zod';
import { ORDER_STATUSES, OrderStatus } from '../types';
import { paginationSchema } from './common.schema';

const statusEnum = z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]);

export const listOrdersSchema = paginationSchema.extend({
  status: statusEnum.optional(),
  userId: z.coerce.number().int().positive().optional(), // solo ADMIN
});

export const updateOrderStatusSchema = z.object({
  status: statusEnum,
});

export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
