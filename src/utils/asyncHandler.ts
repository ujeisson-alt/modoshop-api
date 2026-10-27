import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Envuelve controllers async para que los errores lleguen al middleware centralizado. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
