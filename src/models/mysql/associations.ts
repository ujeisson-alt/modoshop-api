import { User } from './User';
import { Category } from './Category';
import { Product } from './Product';
import { ProductVariant } from './ProductVariant';
import { Stock } from './Stock';
import { Order } from './Order';
import { OrderItem } from './OrderItem';
import { Coupon } from './Coupon';
import { Payment } from './Payment';

let initialized = false;

export const setupAssociations = (): void => {
  if (initialized) return;
  initialized = true;

  // Categorías anidadas (self-reference)
  Category.hasMany(Category, { foreignKey: 'parentId', as: 'subcategories' });
  Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });

  // Productos
  Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
  Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
  ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
  ProductVariant.hasOne(Stock, { foreignKey: 'variantId', as: 'stock' });
  Stock.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

  // Órdenes
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  Order.belongsTo(User, { foreignKey: 'userId', as: 'customer' });
  Order.belongsTo(Coupon, { foreignKey: 'couponId', as: 'coupon' });
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  Order.hasOne(Payment, { foreignKey: 'orderId', as: 'payment' });
  OrderItem.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });
};
