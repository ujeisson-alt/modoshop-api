import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Valida y normaliza la entrada con Zod. El resultado parseado queda en res.locals.validated[source]
 * (Express 4 no permite reasignar req.query de forma segura en todos los casos).
 */
export const validate =
  (schema: ZodType, source: Source = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    const current = (res.locals.validated ?? {}) as Partial<Record<Source, unknown>>;
    res.locals.validated = { ...current, [source]: result.data };
    if (source === 'body') req.body = result.data;
    next();
  };

/** Recupera los datos validados con su tipo. */
export const getValidated = <T>(res: Response, source: Source): T => {
  const store = res.locals.validated as Partial<Record<Source, unknown>> | undefined;
  return store?.[source] as T;
};
