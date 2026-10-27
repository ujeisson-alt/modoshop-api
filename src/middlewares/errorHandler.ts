import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } from 'sequelize';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const createError = (message: string, statusCode = 500, details?: unknown): AppError =>
  new AppError(message, statusCode, details);

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(createError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { errors: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof UniqueConstraintError) {
    res.status(409).json({
      success: false,
      message: 'El recurso ya existe',
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
    return;
  }

  if (err instanceof ForeignKeyConstraintError) {
    res.status(409).json({ success: false, message: 'Referencia inválida a otro recurso' });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, message: 'JSON mal formado' });
    return;
  }

  logger.error('Error no controlado', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    ...(env.isProduction || !(err instanceof Error) ? {} : { detail: err.message }),
  });
};
