import { NextFunction, Request, Response } from 'express';
import { createError } from './errorHandler';
import { verifyToken } from '../utils/jwt';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    next(createError('Token no proporcionado', 401));
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(createError('Token inválido o expirado', 401));
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'ADMIN') {
    next(createError('Acceso solo para administradores', 403));
    return;
  }
  next();
};

/** Garantiza que un CUSTOMER solo accede a sus propios recursos (ADMIN accede a todo). */
export const requireOwner =
  (userIdParam = 'id') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const resourceUserId = Number.parseInt(String(req.params[userIdParam]), 10);
    if (req.user?.role !== 'ADMIN' && req.user?.id !== resourceUserId) {
      next(createError('No tenés permiso para acceder a este recurso', 403));
      return;
    }
    next();
  };
