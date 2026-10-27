import { Router } from 'express';
import {
  adjustProductStock,
  createProduct,
  deactivateProduct,
  getProduct,
  getProductStock,
  listProducts,
  updateProduct,
} from '../controllers/products.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { idParamSchema } from '../schemas/common.schema';
import {
  adjustStockSchema,
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from '../schemas/product.schema';

const router = Router();
const byId = validate(idParamSchema, 'params');

// Público
router.get('/', validate(listProductsSchema, 'query'), asyncHandler(listProducts));
router.get('/:id', byId, asyncHandler(getProduct));

// Admin
router.post('/', authMiddleware, requireAdmin, validate(createProductSchema), asyncHandler(createProduct));
router.put('/:id', authMiddleware, requireAdmin, byId, validate(updateProductSchema), asyncHandler(updateProduct));
router.delete('/:id', authMiddleware, requireAdmin, byId, asyncHandler(deactivateProduct));
router.get('/:id/stock', authMiddleware, requireAdmin, byId, asyncHandler(getProductStock));
router.patch('/:id/stock', authMiddleware, requireAdmin, byId, validate(adjustStockSchema), asyncHandler(adjustProductStock));

export default router;
