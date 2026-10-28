import fs from 'fs';
import path from 'path';
import { QueryTypes } from 'sequelize';
import { sequelize } from './database';
import { logger } from '../utils/logger';
import { splitStatements, stripDatabaseSelection } from '../utils/sqlSplitter';

// dist/database (copiado en el build) o ./database en desarrollo con ts-node
const SQL_DIR =
  [path.resolve(__dirname, '..', 'database'), path.resolve(__dirname, '..', '..', 'database')].find((dir) =>
    fs.existsSync(path.join(dir, 'schema.sql')),
  ) ?? path.resolve(process.cwd(), 'database');

const runFile = async (file: string): Promise<number> => {
  const raw = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
  const statements = stripDatabaseSelection(splitStatements(raw));
  for (const statement of statements) await sequelize.query(statement);
  return statements.length;
};

/**
 * Despliegue sin pasos manuales: si DB_AUTO_SETUP=true y la base está vacía
 * (no existe la tabla products), ejecuta database/schema.sql y database/seed.sql.
 * Si las tablas ya existen no toca nada, así que es seguro en cada reinicio.
 */
export const ensureDatabaseSchema = async (): Promise<void> => {
  if (process.env.DB_AUTO_SETUP !== 'true') return;
  const rows = await sequelize.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'products'`,
    { type: QueryTypes.SELECT },
  );
  if (Number(rows[0]?.total ?? 0) > 0) return;

  logger.info('🛠️  Base vacía: creando tablas, vista y stored procedure...');
  const schema = await runFile('schema.sql');
  const seed = process.env.DB_AUTO_SEED === 'false' ? 0 : await runFile('seed.sql');
  logger.info(`✅ Base inicializada (${schema} sentencias de esquema, ${seed} de datos de prueba)`);
};
