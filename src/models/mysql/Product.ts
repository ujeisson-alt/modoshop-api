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
import type { ProductVariant } from './ProductVariant';
import type { Category } from './Category';

export class Product extends Model<InferAttributes<Product>, InferCreationAttributes<Product>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string | null;
  declare basePrice: number;
  declare categoryId: number | null;
  declare brand: string | null;
  declare imagesJson: string[] | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;

  declare variants?: NonAttribute<ProductVariant[]>;
  declare category?: NonAttribute<Category>;
}

Product.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    basePrice: decimalColumn('basePrice', 10, 2, { allowNull: false }),
    categoryId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    brand: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    imagesJson: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Product', tableName: 'products', timestamps: true, updatedAt: false },
);
