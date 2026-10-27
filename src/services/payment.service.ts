import { env } from '../config/env';
import { PaymentMethod } from '../types';

export interface PaymentResult {
  success: boolean;
  externalRef: string;
  message: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulador de pasarela de pagos. Éxito configurable con PAYMENT_SUCCESS_RATE (0.9 = 90 %).
 * En v2 se reemplaza por MercadoPago/Stripe + webhooks.
 */
export const PaymentService = {
  async charge(amount: number, method: PaymentMethod): Promise<PaymentResult> {
    if (env.payment.latencyMs > 0) await sleep(env.payment.latencyMs);
    const externalRef = `SIM-${method}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    if (amount <= 0) return { success: true, externalRef, message: 'Monto cero: sin cargo' };
    const success = Math.random() < env.payment.successRate;
    return {
      success,
      externalRef,
      message: success ? 'Pago aprobado' : 'Pago rechazado por la entidad emisora (simulado)',
    };
  },
};
