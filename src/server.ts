import { env } from './config/env';
import app from './app';
import { connectMySQL, sequelize } from './config/database';
import { connectRedis, redis } from './config/redis';
import { connectMongoDB } from './config/mongodb';
import mongoose from 'mongoose';
import { logger } from './utils/logger';

const start = async (): Promise<void> => {
  try {
    await connectMySQL();
    await connectRedis();
    await connectMongoDB();
  } catch (err) {
    logger.error('❌ No se pudo iniciar: revisá MySQL y Redis', err);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`🚀 ModoShop API corriendo en puerto ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} recibido: cerrando conexiones...`);
    server.close(async () => {
      await Promise.allSettled([sequelize.close(), redis.quit(), mongoose.disconnect()]);
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

void start();
