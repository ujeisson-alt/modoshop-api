import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUser, UserRole } from '../types';

export const signToken = (user: AuthUser): string =>
  jwt.sign({ id: user.id, role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  });

const isRole = (value: unknown): value is UserRole => value === 'CUSTOMER' || value === 'ADMIN';

export const verifyToken = (token: string): AuthUser => {
  const payload = jwt.verify(token, env.jwt.secret);
  if (typeof payload === 'string' || typeof payload.id !== 'number' || !isRole(payload.role)) {
    throw new Error('Payload de token inválido');
  }
  return { id: payload.id, role: payload.role };
};
