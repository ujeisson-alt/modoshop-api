import { DataTypes, ModelAttributeColumnOptions, Model } from 'sequelize';
import { toNumber } from '../../utils/money';

/**
 * Columna DECIMAL que siempre se lee como number (mysql2 puede devolver strings).
 */
export const decimalColumn = (
  field: string,
  precision: number,
  scale: number,
  options: Partial<ModelAttributeColumnOptions> = {},
): ModelAttributeColumnOptions<Model> => ({
  type: DataTypes.DECIMAL(precision, scale),
  ...options,
  get(this: Model) {
    const raw: unknown = this.getDataValue(field);
    return raw === null || raw === undefined ? raw : toNumber(raw);
  },
});
