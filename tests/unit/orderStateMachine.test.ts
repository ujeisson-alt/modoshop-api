import { assertTransition, canTransition, isFinalStatus } from '../../src/services/orderStateMachine';
import { AppError } from '../../src/middlewares/errorHandler';

describe('Máquina de estados de la orden', () => {
  it.each([
    ['PENDING', 'PROCESSING'],
    ['PROCESSING', 'PAID'],
    ['PROCESSING', 'FAILED'],
    ['PROCESSING', 'CANCELLED'],
    ['PAID', 'SHIPPED'],
    ['PAID', 'CANCELLED'],
    ['SHIPPED', 'DELIVERED'],
  ] as const)('permite %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['PENDING', 'PAID'],
    ['PAID', 'DELIVERED'],
    ['FAILED', 'PAID'],
    ['DELIVERED', 'CANCELLED'],
    ['SHIPPED', 'CANCELLED'],
  ] as const)('bloquea %s → %s con 409', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(AppError);
    try {
      assertTransition(from, to);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(409);
    }
  });

  it('identifica estados finales', () => {
    expect(isFinalStatus('FAILED')).toBe(true);
    expect(isFinalStatus('CANCELLED')).toBe(true);
    expect(isFinalStatus('DELIVERED')).toBe(true);
    expect(isFinalStatus('PAID')).toBe(false);
  });
});
