import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../../config/database';
import { decimalColumn } from './decimal';
import type { Product } from './Product';
import type { Stock } from './Stock';

export class ProductVariant extends Model<
  InferAttributes<ProductVariant>,
  InferCreationAttributes<ProductVariant>
> {
  declare id: CreationOptional<number>;
  declare productId: number;
  declare size: string | null;
  declare color: string | null;
  declare sku: string;
  declare priceModifier: CreationOptional<number>;

  declare product?: NonAttribute<Product>;
  declare stock?: NonAttribute<Stock>;
}

ProductVariant.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    size: { type: DataTypes.STRING(20), allowNull: true, defaultValue: null },
    color: { type: DataTypes.STRING(50), allowNull: true, defaultValue: null },
    sku: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    priceModifier: decimalColumn('priceModifier', 8, 2, { allowNull: false, defaultValue: 0 }),
  },
  { sequelize, modelName: 'ProductVariant', tableName: 'product_variants', timestamps: false },
);
