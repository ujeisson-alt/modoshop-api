import { ActivityLog } from '../models/mongo/ActivityLog';
import { isMongoConnected } from '../config/mongodb';
import { logger } from './logger';
import { UserRole } from '../types';

export interface ActivityEntry {
  userId?: number | null;
  userRole?: UserRole | 'GUEST';
  action: string;
  resourceType: string;
  resourceId?: number | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Registra un evento en MongoDB. Nunca lanza: un fallo de logging no debe romper una venta.
 */
export const logActivity = async (entry: ActivityEntry): Promise<void> => {
  if (!isMongoConnected()) return;
  try {
    await ActivityLog.create({ userRole: 'GUEST', ...entry });
  } catch (err) {
    logger.warn('No se pudo guardar el log de actividad', err);
  }
};
