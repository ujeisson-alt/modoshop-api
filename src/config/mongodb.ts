import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * MongoDB guarda únicamente logs de actividad. Si no está disponible la API sigue
 * funcionando (los logs se descartan) para no bloquear ventas por un servicio secundario.
 */
export const connectMongoDB = async (): Promise<void> => {
  if (!env.mongoUri) {
    logger.warn('⚠️  MONGODB_URI no definida: los logs de actividad no se persistirán');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    logger.info('✅ MongoDB conectado');
  } catch (err) {
    logger.error('❌ No se pudo conectar a MongoDB (la API continúa sin logs)', err);
  }
};

export const isMongoConnected = (): boolean => mongoose.connection.readyState === 1;
