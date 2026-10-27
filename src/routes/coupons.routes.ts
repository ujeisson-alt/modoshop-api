import { Router } from 'express';
import { createCoupon, deactivateCoupon, listCoupons } from '../controllers/coupons.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../schemas/common.schema';
import { createCouponSchema, listCouponsSchema } from '../schemas/coupon.schema';

const router = Router();

router.use(authMiddleware, requireAdmin);
router.get('/', validate(listCouponsSchema, 'query'), asyncHandler(listCoupons));
router.post('/', validate(createCouponSchema), asyncHandler(createCoupon));
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(deactivateCoupon));

export default router;
