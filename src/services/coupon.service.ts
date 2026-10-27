import { Transaction } from 'sequelize';
import { Coupon } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { CouponType } from '../types';
import { round2 } from '../utils/money';

export interface CouponRules {
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
}

/** Calcula el descuento. Nunca supera el subtotal. */
export const calculateDiscount = (coupon: Pick<CouponRules, 'type' | 'value'>, subtotal: number): number => {
  const raw = coupon.type === 'PERCENTAGE' ? subtotal * (coupon.value / 100) : coupon.value;
  return round2(Math.min(raw, subtotal));
};

/** Reglas de negocio del cupón. Lanza 400 con un mensaje claro si no es aplicable. */
export const assertCouponApplicable = (coupon: CouponRules, subtotal: number, now: Date = new Date()): void => {
  if (!coupon.isActive) throw createError('Cupón inválido o inactivo', 400);
  if (coupon.expiresAt && now > coupon.expiresAt) throw createError('El cupón ha expirado', 400);
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw createError('El cupón alcanzó su límite de usos', 400);
  }
  if (subtotal < coupon.minOrderAmount) {
    throw createError(`El pedido mínimo para este cupón es $${coupon.minOrderAmount.toFixed(2)}`, 400, {
      minOrderAmount: coupon.minOrderAmount,
      subtotal,
      missing: round2(coupon.minOrderAmount - subtotal),
    });
  }
};

export const CouponService = {
  /** Busca el cupón por código, valida las reglas y devuelve el descuento. */
  async resolve(
    code: string,
    subtotal: number,
    transaction?: Transaction,
  ): Promise<{ coupon: Coupon; discountAmount: number }> {
    const coupon = await Coupon.findOne({
      where: { code: code.toUpperCase() },
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!coupon) throw createError('Cupón inválido o inactivo', 400);
    assertCouponApplicable(coupon, subtotal);
    return { coupon, discountAmount: calculateDiscount(coupon, subtotal) };
  },
};
