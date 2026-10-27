import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { CartService, CartServiceType } from './cart.service';
import { CouponService } from './coupon.service';
import { PaymentService } from './payment.service';
import { assertTransition } from './orderStateMachine';
import { variantPrice } from './product.service';
import { Coupon, Order, OrderItem, Payment, Product, ProductVariant, Stock, User } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { logActivity } from '../utils/activityLog';
import { logger } from '../utils/logger';
import { round2 } from '../utils/money';
import { CartItem, OrderStatus, PaymentMethod, PaymentStatus } from '../types';

export interface PricedLine {
  variantId: number;
  productName: string;
  size: string | null;
  quantity: number;
  unitPrice: number;
}

export interface CheckoutParams {
  userId: number;
  paymentMethod: PaymentMethod;
  shippingAddress?: string;
  couponCode?: string;
}

export interface CheckoutResult {
  order: Order;
  paymentStatus: PaymentStatus;
  paymentMessage: string;
}

/**
 * Reprecia el carrito con los precios ACTUALES de la base de datos (el precio guardado en Redis
 * es solo una referencia) y verifica que los productos sigan activos.
 */
const priceCart = async (cartItems: CartItem[], transaction?: Transaction): Promise<PricedLine[]> => {
  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: cartItems.map((i) => i.variantId) } },
    include: [{ model: Product, as: 'product' }],
    transaction,
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  return cartItems.map((item) => {
    const variant = byId.get(item.variantId);
    if (!variant?.product || !variant.product.isActive) {
      throw createError(`El producto «${item.productName}» ya no está disponible. Quitalo del carrito.`, 409);
    }
    return {
      variantId: variant.id,
      productName: variant.product.name,
      size: variant.size,
      quantity: item.quantity,
      unitPrice: variantPrice(variant.product, variant),
    };
  });
};

const subtotalOf = (lines: PricedLine[]): number =>
  round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));

export const createCheckoutService = (cart: CartServiceType) => {
  /** Previsualiza el descuento de un cupón sobre el carrito actual (no consume usos). */
  const previewCoupon = async (userId: number, code: string) => {
    const cartItems = await cart.getCart(userId);
    if (cartItems.length === 0) throw createError('El carrito está vacío', 400);
    const lines = await priceCart(cartItems);
    const subtotal = subtotalOf(lines);
    const { coupon, discountAmount } = await CouponService.resolve(code, subtotal);
    return {
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      subtotal,
      discountAmount,
      total: round2(subtotal - discountAmount),
      expiresAt: coupon.expiresAt,
    };
  };

  /**
   * FASE 1 — Reserva (transacción corta con SELECT ... FOR UPDATE):
   * valida cupón, bloquea las filas de stock, reserva unidades y crea la orden en PROCESSING.
   */
  const reserve = async (params: CheckoutParams, cartItems: CartItem[], shippingAddress: string) =>
    sequelize.transaction(async (transaction) => {
      const lines = await priceCart(cartItems, transaction);
      const subtotal = subtotalOf(lines);

      let couponId: number | null = null;
      let discountAmount = 0;
      if (params.couponCode) {
        const resolved = await CouponService.resolve(params.couponCode, subtotal, transaction);
        couponId = resolved.coupon.id;
        discountAmount = resolved.discountAmount;
        // Se "reserva" un uso del cupón; si el pago falla se devuelve.
        await resolved.coupon.increment('usedCount', { by: 1, transaction });
      }
      const total = round2(subtotal - discountAmount);

      // Bloqueo en orden ascendente de variantId para evitar deadlocks entre checkouts concurrentes
      const sorted = [...lines].sort((a, b) => a.variantId - b.variantId);
      for (const line of sorted) {
        const stock = await Stock.findOne({
          where: { variantId: line.variantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!stock) throw createError(`Variante ${line.variantId} sin stock registrado`, 409);
        if (stock.available < line.quantity) {
          throw createError(
            `Stock insuficiente para «${line.productName}»${line.size ? ` (${line.size})` : ''}. Disponibles: ${Math.max(stock.available, 0)}`,
            409,
            { variantId: line.variantId, requested: line.quantity, available: Math.max(stock.available, 0) },
          );
        }
        await stock.increment('reservedQuantity', { by: line.quantity, transaction });
      }

      const order = await Order.create(
        { userId: params.userId, couponId, status: 'PENDING', subtotal, discountAmount, total, shippingAddress },
        { transaction },
      );
      assertTransition('PENDING', 'PROCESSING');
      await order.update({ status: 'PROCESSING' }, { transaction });

      await OrderItem.bulkCreate(
        lines.map((l) => ({ orderId: order.id, variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
        { transaction },
      );
      await Payment.create(
        { orderId: order.id, status: 'PROCESSING', method: params.paymentMethod, amount: total, externalRef: null, processedAt: null },
        { transaction },
      );
      return { orderId: order.id, lines: sorted, couponId, total };
    });

  /**
   * FASE 3 — Confirmación o liberación (transacción corta):
   * pago OK  → descuenta stock físico y libera la reserva, orden PAID.
   * pago KO  → libera la reserva, devuelve el uso del cupón, orden FAILED.
   */
  const finalize = async (
    orderId: number,
    lines: PricedLine[],
    couponId: number | null,
    paid: boolean,
    externalRef: string | null,
  ): Promise<void> =>
    sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!order) throw createError('Orden no encontrada al finalizar el checkout', 500);
      const target: OrderStatus = paid ? 'PAID' : 'FAILED';
      assertTransition(order.status, target);

      for (const line of lines) {
        const stock = await Stock.findOne({
          where: { variantId: line.variantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!stock) continue;
        await stock.update(
          {
            reservedQuantity: Math.max(stock.reservedQuantity - line.quantity, 0),
            ...(paid ? { quantity: stock.quantity - line.quantity } : {}),
          },
          { transaction },
        );
      }

      if (!paid && couponId) {
        await Coupon.decrement('usedCount', { by: 1, where: { id: couponId, usedCount: { [Op.gt]: 0 } }, transaction });
      }

      await Payment.update(
        { status: paid ? 'PAID' : 'FAILED', externalRef, processedAt: new Date() },
        { where: { orderId }, transaction },
      );
      await order.update({ status: target }, { transaction });
    });

  const loadOrder = (orderId: number): Promise<Order | null> =>
    Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: ProductVariant,
              as: 'variant',
              attributes: ['id', 'sku', 'size', 'color'],
              include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
            },
          ],
        },
        { model: Payment, as: 'payment' },
        { model: Coupon, as: 'coupon', attributes: ['id', 'code', 'type', 'value'] },
      ],
    });

  const processCheckout = async (params: CheckoutParams): Promise<CheckoutResult> => {
    // 1. Carrito desde Redis
    const cartItems = await cart.getCart(params.userId);
    if (cartItems.length === 0) throw createError('El carrito está vacío', 400);

    // Dirección: la del body o la guardada en el perfil
    let shippingAddress = params.shippingAddress;
    if (!shippingAddress) {
      const user = await User.findByPk(params.userId, { attributes: ['address'] });
      shippingAddress = user?.address ?? undefined;
    }
    if (!shippingAddress) {
      throw createError('Indicá una dirección de envío (shippingAddress) o guardala en tu perfil', 400);
    }

    // 2. Reserva de stock + orden PROCESSING
    const reservation = await reserve(params, cartItems, shippingAddress);

    // 3. Cobro (fuera de la transacción: no mantenemos locks mientras la pasarela responde)
    let paid = false;
    let externalRef: string | null = null;
    let paymentMessage = 'Pago rechazado';
    try {
      const result = await PaymentService.charge(reservation.total, params.paymentMethod);
      paid = result.success;
      externalRef = result.externalRef;
      paymentMessage = result.message;
    } catch (err) {
      logger.error(`Error en la pasarela para la orden ${reservation.orderId}`, err);
      paymentMessage = 'Error de comunicación con la pasarela de pagos';
    }

    // 4. Confirmar o liberar la reserva
    await finalize(reservation.orderId, reservation.lines, reservation.couponId, paid, externalRef);

    // 5. Limpiar carrito solo si el pago fue exitoso (si falla, el usuario puede reintentar)
    if (paid) await cart.clearCart(params.userId);

    // 6. Log en MongoDB (no bloqueante para el negocio)
    await logActivity({
      userId: params.userId,
      userRole: 'CUSTOMER',
      action: paid ? 'ORDER_PAID' : 'ORDER_FAILED',
      resourceType: 'ORDER',
      resourceId: reservation.orderId,
      metadata: { total: reservation.total, paymentMethod: params.paymentMethod, couponCode: params.couponCode ?? null },
    });

    const order = await loadOrder(reservation.orderId);
    if (!order) throw createError('No se pudo recuperar la orden', 500);
    return { order, paymentStatus: paid ? 'PAID' : 'FAILED', paymentMessage };
  };

  return { previewCoupon, processCheckout, loadOrder };
};

export const CheckoutService = createCheckoutService(CartService);
