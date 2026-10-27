import { OrderStatus } from '../types';
import { createError } from '../middlewares/errorHandler';

/**
 * Máquina de estados de una orden.
 *
 *   PENDING ──► PROCESSING ──► PAID ──► SHIPPED ──► DELIVERED
 *      │            │  │         │
 *      ▼            ▼  ▼         ▼
 *  CANCELLED     FAILED CANCELLED CANCELLED (con reintegro de stock)
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  FAILED: [],
  CANCELLED: [],
  DELIVERED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_TRANSITIONS[from].includes(to);

export const assertTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransition(from, to)) {
    const allowed = ORDER_TRANSITIONS[from];
    throw createError(
      `Transición inválida: ${from} → ${to}. ${
        allowed.length ? `Permitidas: ${allowed.join(', ')}` : `${from} es un estado final`
      }`,
      409,
    );
  }
};

export const isFinalStatus = (status: OrderStatus): boolean => ORDER_TRANSITIONS[status].length === 0;
