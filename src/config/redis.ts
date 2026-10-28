import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const retryStrategy = (times: number): number => Math.min(times * 50, 2000);

const createRedisClient = (): Redis => {
  if (env.redis.url) {
    // Upstash (producción) usa TLS con el esquema rediss://
    const useTls = env.redis.url.startsWith('rediss://');
    return new Redis(env.redis.url, {
      retryStrategy,
      lazyConnect: true,
      family: 0, // IPv4 + IPv6 (la red privada de Railway usa IPv6)
      ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
    });
  }
  return new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    retryStrategy,
    lazyConnect: true,
  });
};

export const redis = createRedisClient();

redis.on('connect', () => logger.info('✅ Redis conectado'));
redis.on('error', (err: Error) => logger.error('❌ Redis error', err.message));

export const connectRedis = async (): Promise<void> => {
  if (redis.status === 'wait' || redis.status === 'end') await redis.connect();
  await redis.ping();
};

export const CART_TTL = env.redis.cartTtl; // 24 h por defecto
