import { Router } from 'express';
import { getSalesReport, getTopProducts } from '../controllers/reports.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { salesReportSchema, topProductsSchema } from '../schemas/report.schema';

const router = Router();

router.use(authMiddleware, requireAdmin);
router.get('/sales', validate(salesReportSchema, 'query'), asyncHandler(getSalesReport));
router.get('/top-products', validate(topProductsSchema, 'query'), asyncHandler(getTopProducts));

export default router;
