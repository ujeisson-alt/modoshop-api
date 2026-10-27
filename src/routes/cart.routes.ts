import { Router } from 'express';
import { addToCart, clearCart, getCart, removeCartItem, updateCartItem } from '../controllers/cart.controller';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { addToCartSchema, updateCartItemSchema } from '../schemas/cart.schema';
import { variantIdParamSchema } from '../schemas/common.schema';

const router = Router();
const byVariant = validate(variantIdParamSchema, 'params');

router.use(authMiddleware);
router.get('/', asyncHandler(getCart));
router.post('/items', validate(addToCartSchema), asyncHandler(addToCart));
router.patch('/items/:variantId', byVariant, validate(updateCartItemSchema), asyncHandler(updateCartItem));
router.delete('/items/:variantId', byVariant, asyncHandler(removeCartItem));
router.delete('/', asyncHandler(clearCart));

export default router;
