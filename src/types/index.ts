export type UserRole = 'CUSTOMER' | 'ADMIN';
export type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'SHIPPED'
  | 'DELIVERED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CASH';
export type CouponType = 'PERCENTAGE' | 'FIXED';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'SHIPPED',
  'DELIVERED',
] as const;

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'TRANSFER',
  'CASH',
] as const;

export interface AuthUser {
  id: number;
  role: UserRole;
}

export interface IUser {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string | null;
  address?: string | null;
}

export interface IProduct {
  id: number;
  name: string;
  description?: string | null;
  basePrice: number;
  categoryId?: number | null;
  brand?: string | null;
  imagesJson?: string[] | null;
  isActive: boolean;
}

export interface IOrder {
  id: number;
  userId: number;
  couponId?: number | null;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  total: number;
  shippingAddress: string;
}

export interface ICoupon {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: Date | null;
  isActive: boolean;
}

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  sku: string;
  size: string | null;
  color: string | null;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
