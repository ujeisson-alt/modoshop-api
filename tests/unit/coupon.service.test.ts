import { assertCouponApplicable, calculateDiscount, CouponRules } from '../../src/services/coupon.service';
import { AppError } from '../../src/middlewares/errorHandler';

const base: CouponRules = {
  type: 'PERCENTAGE',
  value: 10,
  minOrderAmount: 0,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  isActive: true,
};

const expectError = (fn: () => void, message: RegExp, status = 400): void => {
  try {
    fn();
    throw new Error('Se esperaba un error');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(status);
    expect((err as AppError).message).toMatch(message);
  }
};

describe('calculateDiscount', () => {
  it('aplica porcentaje sobre el subtotal', () => {
    expect(calculateDiscount({ type: 'PERCENTAGE', value: 10 }, 32400)).toBe(3240);
  });

  it('redondea a 2 decimales', () => {
    expect(calculateDiscount({ type: 'PERCENTAGE', value: 15 }, 99.99)).toBe(15);
  });

  it('aplica monto fijo', () => {
    expect(calculateDiscount({ type: 'FIXED', value: 5000 }, 32000)).toBe(5000);
  });

  it('el descuento fijo nunca supera el subtotal', () => {
    expect(calculateDiscount({ type: 'FIXED', value: 5000 }, 3000)).toBe(3000);
  });
});

describe('assertCouponApplicable', () => {
  it('acepta un cupón válido', () => {
    expect(() => assertCouponApplicable(base, 1000)).not.toThrow();
  });

  it('rechaza un cupón inactivo', () => {
    expectError(() => assertCouponApplicable({ ...base, isActive: false }, 1000), /inactivo/);
  });

  it('rechaza un cupón vencido', () => {
    expectError(
      () => assertCouponApplicable({ ...base, expiresAt: new Date('2024-01-01') }, 1000, new Date('2026-01-01')),
      /expirado/,
    );
  });

  it('rechaza cuando se alcanzó el límite de usos', () => {
    expectError(() => assertCouponApplicable({ ...base, maxUses: 2, usedCount: 2 }, 1000), /límite de usos/);
  });

  it('acepta usos ilimitados (maxUses null)', () => {
    expect(() => assertCouponApplicable({ ...base, maxUses: null, usedCount: 9999 }, 1000)).not.toThrow();
  });

  it('rechaza si no se alcanza el monto mínimo e informa cuánto falta', () => {
    try {
      assertCouponApplicable({ ...base, minOrderAmount: 30000 }, 25000);
      throw new Error('Se esperaba un error');
    } catch (err) {
      expect((err as AppError).message).toMatch(/pedido mínimo/);
      expect((err as AppError).details).toEqual({ minOrderAmount: 30000, subtotal: 25000, missing: 5000 });
    }
  });
});
