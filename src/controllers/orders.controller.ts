import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { getValidated } from '../middlewares/validate';
import { IdParam } from '../schemas/common.schema';
import { ListOrdersQuery, UpdateOrderStatusInput } from '../schemas/order.schema';
import { logActivity } from '../utils/activityLog';

export const listOrders = async (req: Request, res: Response): Promise<void> => {
  const { items, meta } = await OrderService.list(req.user!, getValidated<ListOrdersQuery>(res, 'query'));
  res.json({ success: true, data: items, meta });
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  res.json({ success: true, data: await OrderService.getById(req.user!, id) });
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  const { status } = req.body as UpdateOrderStatusInput;
  const order = await OrderService.updateStatus(id, status);
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: `ORDER_${status}`, resourceType: 'ORDER', resourceId: id });
  res.json({ success: true, message: `Pedido actualizado a ${status}`, data: order });
};
