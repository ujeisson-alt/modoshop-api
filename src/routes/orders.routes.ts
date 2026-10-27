import { Router } from 'express';
import { getOrder, listOrders, updateOrderStatus } from '../controllers/orders.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../schemas/common.schema';
import { listOrdersSchema, updateOrderStatusSchema } from '../schemas/order.schema';

const router = Router();
const byId = validate(idParamSchema, 'params');

router.use(authMiddleware);
router.get('/', validate(listOrdersSchema, 'query'), asyncHandler(listOrders));
router.get('/:id', byId, asyncHandler(getOrder));
router.patch('/:id/status', requireAdmin, byId, validate(updateOrderStatusSchema), asyncHandler(updateOrderStatus));

export default router;
