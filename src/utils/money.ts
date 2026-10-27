/** Redondea a 2 decimales evitando errores de coma flotante (0.1 + 0.2). */
export const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Convierte DECIMAL de MySQL (string | number | null) a number. */
export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};
