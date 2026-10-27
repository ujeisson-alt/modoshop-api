import { Router } from 'express';
import { checkout, validateCoupon } from '../controllers/checkout.controller';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { checkoutLimiter } from '../middlewares/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { checkoutSchema, validateCouponSchema } from '../schemas/checkout.schema';

const router = Router();

router.use(authMiddleware);
router.post('/validate-coupon', validate(validateCouponSchema), asyncHandler(validateCoupon));
router.post('/', checkoutLimiter, validate(checkoutSchema), asyncHandler(checkout));

export default router;
