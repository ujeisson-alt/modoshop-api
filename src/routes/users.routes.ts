import { Router } from 'express';
import { getMe, getUserById, listUsers, updateMe } from '../controllers/users.controller';
import { authMiddleware, requireAdmin, requireOwner } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { listUsersSchema, updateProfileSchema } from '../schemas/user.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

router.use(authMiddleware);
router.get('/me', asyncHandler(getMe));
router.put('/me', validate(updateProfileSchema), asyncHandler(updateMe));
router.get('/', requireAdmin, validate(listUsersSchema, 'query'), asyncHandler(listUsers));
router.get('/:id', validate(idParamSchema, 'params'), requireOwner('id'), asyncHandler(getUserById));

export default router;
