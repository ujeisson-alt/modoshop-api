import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';

const skip = (): boolean => env.isTest;

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá más tarde.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  skipSuccessfulRequests: true, // solo cuentan los intentos fallidos (anti fuerza bruta)
  message: { success: false, message: 'Demasiados intentos. Intentá en 15 minutos.' },
});

// Limitar el checkout a 5 intentos por minuto por usuario (prevenir bots)
export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  keyGenerator: (req) => (req.user ? `checkout:user:${req.user.id}` : `checkout:ip:${ipKeyGenerator(req.ip ?? '')}`),
  message: { success: false, message: 'Demasiados intentos de pago. Esperá un momento.' },
});
