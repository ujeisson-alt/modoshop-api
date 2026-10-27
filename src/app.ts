import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { redis } from './config/redis';
import { sequelize } from './config/database';
import { isMongoConnected } from './config/mongodb';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { globalLimiter } from './middlewares/rateLimiter';
import { asyncHandler } from './utils/asyncHandler';
import './models/mysql';

import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';
import productsRouter from './routes/products.routes';
import cartRouter from './routes/cart.routes';
import checkoutRouter from './routes/checkout.routes';
import ordersRouter from './routes/orders.routes';
import couponsRouter from './routes/coupons.routes';
import reportsRouter from './routes/reports.routes';

const app = express();

app.set('trust proxy', 1); // Railway/Render están detrás de un proxy
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',').map((o) => o.trim()),
  }),
);
app.use(express.json({ limit: '100kb' }));
if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use('/api', globalLimiter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🛍️  Bienvenido a ModoShop API',
    version: '1.0.0',
    docs: 'https://github.com/ujeisson-alt/modoshop-api#readme',
    health: '/health',
  });
});

app.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const check = async (fn: () => Promise<unknown>): Promise<'up' | 'down'> => {
      try {
        await fn();
        return 'up';
      } catch {
        return 'down';
      }
    };
    const [mysql, cache] = await Promise.all([check(() => sequelize.authenticate()), check(() => redis.ping())]);
    const services = { mysql, redis: cache, mongodb: isMongoConnected() ? 'up' : 'down' };
    const healthy = mysql === 'up' && cache === 'up';
    res.status(healthy ? 200 : 503).json({ success: healthy, services, uptime: Math.round(process.uptime()) });
  }),
);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/coupons', couponsRouter);
app.use('/api/v1/reports', reportsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
