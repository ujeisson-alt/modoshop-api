import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { decimalColumn } from './decimal';
import { CouponType } from '../../types';

export class Coupon extends Model<InferAttributes<Coupon>, InferCreationAttributes<Coupon>> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare type: CouponType;
  declare value: number;
  declare minOrderAmount: CreationOptional<number>;
  declare maxUses: number | null;
  declare usedCount: CreationOptional<number>;
  declare expiresAt: Date | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
}

Coupon.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('PERCENTAGE', 'FIXED'), allowNull: false },
    value: decimalColumn('value', 8, 2, { allowNull: false }),
    minOrderAmount: decimalColumn('minOrderAmount', 10, 2, { allowNull: false, defaultValue: 0 }),
    maxUses: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expiresAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Coupon', tableName: 'coupons', timestamps: true, updatedAt: false },
);
