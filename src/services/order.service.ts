import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { Coupon, Order, OrderItem, Payment, Stock, User } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { assertTransition } from './orderStateMachine';
import { CheckoutService } from './checkout.service';
import { buildMeta, getPagination } from '../utils/pagination';
import { AuthUser, OrderStatus } from '../types';
import { ListOrdersQuery } from '../schemas/order.schema';

export const OrderService = {
  async list(requester: AuthUser, query: ListOrdersQuery) {
    const { page, limit, status, userId } = query;
    const where: WhereOptions<Order> = {};
    // Un CUSTOMER solo ve sus pedidos; el ADMIN puede filtrar por usuario
    if (requester.role === 'CUSTOMER') where.userId = requester.id;
    else if (userId) where.userId = userId;
    if (status) where.status = status;

    const { offset } = getPagination(page, limit);
    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        { model: OrderItem, as: 'items', attributes: ['id', 'variantId', 'quantity', 'unitPrice'] },
        { model: Payment, as: 'payment', attributes: ['status', 'method', 'amount', 'processedAt'] },
        ...(requester.role === 'ADMIN'
          ? [{ model: User, as: 'customer', attributes: ['id', 'name', 'email'] }]
          : []),
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
      distinct: true,
    });
    return { items: rows, meta: buildMeta(page, limit, count) };
  },

  async getById(requester: AuthUser, id: number): Promise<Order> {
    const order = await CheckoutService.loadOrder(id);
    if (!order) throw createError('Pedido no encontrado', 404);
    if (requester.role !== 'ADMIN' && order.userId !== requester.id) {
      // 404 en lugar de 403 para no revelar la existencia de pedidos ajenos
      throw createError('Pedido no encontrado', 404);
    }
    return order;
  },

  /**
   * Cambio de estado manual (ADMIN) respetando la máquina de estados.
   * Efectos colaterales:
   *  - PROCESSING → CANCELLED: libera el stock reservado y devuelve el uso del cupón.
   *  - PAID → CANCELLED: reintegra el stock vendido y marca el pago como REFUNDED.
   */
  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: OrderItem, as: 'items' }],
      });
      if (!order) throw createError('Pedido no encontrado', 404);
      assertTransition(order.status, status);

      if (status === 'CANCELLED' && (order.status === 'PROCESSING' || order.status === 'PAID')) {
        const items = [...(order.items ?? [])].sort((a, b) => a.variantId - b.variantId);
        for (const item of items) {
          const stock = await Stock.findOne({
            where: { variantId: item.variantId },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!stock) continue;
          if (order.status === 'PROCESSING') {
            await stock.update(
              { reservedQuantity: Math.max(stock.reservedQuantity - item.quantity, 0) },
              { transaction },
            );
          } else {
            await stock.update({ quantity: stock.quantity + item.quantity }, { transaction });
          }
        }
        if (order.status === 'PROCESSING' && order.couponId) {
          await Coupon.decrement('usedCount', {
            by: 1,
            where: { id: order.couponId, usedCount: { [Op.gt]: 0 } },
            transaction,
          });
        }
        await Payment.update(
          { status: order.status === 'PAID' ? 'REFUNDED' : 'FAILED', processedAt: new Date() },
          { where: { orderId: order.id }, transaction },
        );
      }
      await order.update({ status }, { transaction });
    });
    const updated = await CheckoutService.loadOrder(id);
    if (!updated) throw createError('Pedido no encontrado', 404);
    return updated;
  },
};
