/* Logger mínimo: centraliza la salida a consola y la silencia en tests. */
import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: unknown): void => {
  if (env.isTest) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(meta === undefined ? `${line}\n` : `${line} ${formatMeta(meta)}\n`);
};

const formatMeta = (meta: unknown): string => {
  if (meta instanceof Error) return meta.stack ?? meta.message;
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
};

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
