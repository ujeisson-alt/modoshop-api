import { Request, Response } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { User } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { getValidated } from '../middlewares/validate';
import { hashPassword } from '../services/auth.service';
import { buildMeta, getPagination } from '../utils/pagination';
import { ListUsersQuery, UpdateProfileInput } from '../schemas/user.schema';
import { IdParam } from '../schemas/common.schema';

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.id);
  if (!user) throw createError('Usuario no encontrado', 404);
  res.json({ success: true, data: user });
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByPk(req.user!.id);
  if (!user) throw createError('Usuario no encontrado', 404);
  const { password, ...rest } = req.body as UpdateProfileInput;
  await user.update({ ...rest, ...(password ? { password: await hashPassword(password) } : {}) });
  res.json({ success: true, message: 'Perfil actualizado', data: user });
};

export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  const { page, limit, role, search } = getValidated<ListUsersQuery>(res, 'query');
  const where: WhereOptions = {};
  if (role) Object.assign(where, { role });
  if (search) {
    Object.assign(where, {
      [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }],
    });
  }
  const { offset } = getPagination(page, limit);
  const { rows, count } = await User.findAndCountAll({ where, limit, offset, order: [['id', 'ASC']] });
  res.json({ success: true, data: rows, meta: buildMeta(page, limit, count) });
};

export const getUserById = async (_req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  const user = await User.findByPk(id);
  if (!user) throw createError('Usuario no encontrado', 404);
  res.json({ success: true, data: user });
};
