import { Options, Sequelize } from 'sequelize';
import { env } from './env';
import { logger } from '../utils/logger';

const baseOptions: Options = {
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  define: { underscored: true, freezeTableName: true },
  dialectOptions: { decimalNumbers: true },
};

// En Railway se puede usar la URL completa (MYSQL_URL / DATABASE_URL)
export const sequelize = env.db.url
  ? new Sequelize(env.db.url, baseOptions)
  : new Sequelize({
      ...baseOptions,
      host: env.db.host,
      port: env.db.port,
      username: env.db.user,
      password: env.db.password,
      database: env.db.name,
    });

export const connectMySQL = async (): Promise<void> => {
  await sequelize.authenticate();
  logger.info('✅ MySQL conectado');
};
