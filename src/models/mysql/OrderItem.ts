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

export class OrderItem extends Model<InferAttributes<OrderItem>, InferCreationAttributes<OrderItem>> {
  declare id: CreationOptional<number>;
  declare orderId: number;
  declare variantId: number;
  declare quantity: number;
  declare unitPrice: number;

  declare variant?: NonAttribute<ProductVariant>;
}

OrderItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    variantId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    unitPrice: decimalColumn('unitPrice', 10, 2, { allowNull: false }),
  },
  { sequelize, modelName: 'OrderItem', tableName: 'order_items', timestamps: false },
);
