import dotenv from 'dotenv';

dotenv.config();

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isNaN(parsed) ? fallback : parsed;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';

const jwtSecret = process.env.JWT_SECRET ?? '';
if (nodeEnv === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: toInt(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'modoshop_db',
    url: process.env.DATABASE_URL ?? process.env.MYSQL_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    cartTtl: toInt(process.env.REDIS_TTL_CART, 86400),
  },
  mongoUri: process.env.MONGODB_URI ?? '',
  jwt: {
    secret: jwtSecret || 'dev_only_secret_change_me_please_32chars!!',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  },
  payment: {
    successRate: toFloat(process.env.PAYMENT_SUCCESS_RATE, 0.9),
    latencyMs: toInt(process.env.PAYMENT_LATENCY_MS, 500),
  },
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
} as const;
