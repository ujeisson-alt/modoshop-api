import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { UserRole } from '../../types';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare password: string;
  declare role: CreationOptional<UserRole>;
  declare phone: string | null;
  declare address: string | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /** Nunca exponer el hash de la contraseña en las respuestas. */
  toJSON(): Omit<InferAttributes<User>, 'password'> {
    const { password: _password, ...safe } = this.get();
    return safe;
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(200), allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('CUSTOMER', 'ADMIN'), allowNull: false, defaultValue: 'CUSTOMER' },
    phone: { type: DataTypes.STRING(30), allowNull: true, defaultValue: null },
    address: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'User', tableName: 'users', timestamps: true },
);
