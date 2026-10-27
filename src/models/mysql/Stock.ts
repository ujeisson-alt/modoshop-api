import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class Stock extends Model<
  InferAttributes<Stock, { omit: 'available' }>,
  InferCreationAttributes<Stock, { omit: 'available' }>
> {
  declare id: CreationOptional<number>;
  declare variantId: number;
  declare quantity: number;
  declare reservedQuantity: CreationOptional<number>;
  declare lastUpdated: CreationOptional<Date>;

  /** Unidades que se pueden vender (físicas - reservadas por checkouts en curso). */
  get available(): number {
    return this.quantity - this.reservedQuantity;
  }
}

Stock.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    variantId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    reservedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    lastUpdated: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Stock',
    tableName: 'stock',
    timestamps: true,
    createdAt: false,
    updatedAt: 'lastUpdated',
  },
);
