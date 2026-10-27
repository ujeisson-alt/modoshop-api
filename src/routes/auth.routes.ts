import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authLimiter } from '../middlewares/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, registerSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(login));

export default router;
