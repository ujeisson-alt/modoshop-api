/**
 * Crea la base de datos y carga los datos de prueba ejecutando database/schema.sql y database/seed.sql.
 * En la nube (Railway) no hace falta: con DB_AUTO_SETUP=true la API crea las tablas al arrancar.
 *
 *   npm run db:setup          → schema + seed
 *   npm run db:setup -- --no-seed
 */
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { splitStatements } from '../src/utils/sqlSplitter';

dotenv.config();

const run = async (): Promise<void> => {
  const dbName = process.env.DB_NAME ?? 'modoshop_db';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  });
  const files = ['schema.sql', ...(process.argv.includes('--no-seed') ? [] : ['seed.sql'])];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'database', file), 'utf8');
    const sql = raw.replace(/modoshop_db/g, dbName);
    const statements = splitStatements(sql);
    for (const statement of statements) await connection.query(statement);
    process.stdout.write(`✔ ${file}: ${statements.length} sentencias ejecutadas\n`);
  }
  await connection.end();
};

run().catch((err: unknown) => {
  process.stderr.write(`✖ Error al preparar la base de datos: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
