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
import { OrderStatus } from '../../types';
import type { OrderItem } from './OrderItem';
import type { Payment } from './Payment';
import type { Coupon } from './Coupon';
import type { User } from './User';

export class Order extends Model<InferAttributes<Order>, InferCreationAttributes<Order>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare couponId: number | null;
  declare status: CreationOptional<OrderStatus>;
  declare subtotal: number;
  declare discountAmount: CreationOptional<number>;
  declare total: number;
  declare shippingAddress: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare items?: NonAttribute<OrderItem[]>;
  declare payment?: NonAttribute<Payment>;
  declare coupon?: NonAttribute<Coupon>;
  declare customer?: NonAttribute<User>;
}

Order.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    couponId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'SHIPPED', 'DELIVERED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    subtotal: decimalColumn('subtotal', 10, 2, { allowNull: false }),
    discountAmount: decimalColumn('discountAmount', 10, 2, { allowNull: false, defaultValue: 0 }),
    total: decimalColumn('total', 10, 2, { allowNull: false }),
    shippingAddress: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Order', tableName: 'orders', timestamps: true },
);
