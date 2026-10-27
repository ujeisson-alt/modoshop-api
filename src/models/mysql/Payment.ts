import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { decimalColumn } from './decimal';
import { PaymentMethod, PaymentStatus } from '../../types';

export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare id: CreationOptional<number>;
  declare orderId: number;
  declare status: CreationOptional<PaymentStatus>;
  declare method: PaymentMethod;
  declare amount: number;
  declare externalRef: string | null;
  declare processedAt: Date | null;
}

Payment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    method: { type: DataTypes.ENUM('CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'CASH'), allowNull: false },
    amount: decimalColumn('amount', 10, 2, { allowNull: false }),
    externalRef: { type: DataTypes.STRING(200), allowNull: true, defaultValue: null },
    processedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  { sequelize, modelName: 'Payment', tableName: 'payments', timestamps: false },
);
