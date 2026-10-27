import { z } from 'zod';
import { PAYMENT_METHODS, PaymentMethod } from '../types';

export const validateCouponSchema = z.object({
  code: z.string().trim().min(3).max(30).toUpperCase(),
});

export const checkoutSchema = z.object({
  shippingAddress: z.string().trim().min(5).max(500).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
  couponCode: z.string().trim().min(3).max(30).toUpperCase().optional(),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
