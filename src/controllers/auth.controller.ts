import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { logActivity } from '../utils/activityLog';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { user, token } = await AuthService.register(req.body as RegisterInput);
  await logActivity({ userId: user.id, userRole: user.role, action: 'USER_REGISTERED', resourceType: 'USER', resourceId: user.id, ip: req.ip });
  res.status(201).json({ success: true, message: 'Usuario registrado', data: { user, token } });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { user, token } = await AuthService.login(req.body as LoginInput);
  await logActivity({ userId: user.id, userRole: user.role, action: 'USER_LOGIN', resourceType: 'USER', resourceId: user.id, ip: req.ip });
  res.json({ success: true, message: 'Login exitoso', data: { user, token } });
};
