import { Request, Response } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { Coupon } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { getValidated } from '../middlewares/validate';
import { IdParam } from '../schemas/common.schema';
import { CreateCouponInput, ListCouponsQuery } from '../schemas/coupon.schema';
import { logActivity } from '../utils/activityLog';

export const listCoupons = async (_req: Request, res: Response): Promise<void> => {
  const { includeInactive } = getValidated<ListCouponsQuery>(res, 'query');
  const where: WhereOptions = includeInactive
    ? {}
    : { isActive: true, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] };
  const coupons = await Coupon.findAll({ where, order: [['createdAt', 'DESC']] });
  res.json({
    success: true,
    data: coupons.map((c) => ({
      ...c.toJSON(),
      remainingUses: c.maxUses === null ? null : Math.max(c.maxUses - c.usedCount, 0),
    })),
  });
};

export const createCoupon = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as CreateCouponInput;
  const exists = await Coupon.findOne({ where: { code: input.code } });
  if (exists) throw createError(`Ya existe un cupón con el código ${input.code}`, 409);
  const coupon = await Coupon.create({
    code: input.code,
    type: input.type,
    value: input.value,
    minOrderAmount: input.minOrderAmount,
    maxUses: input.maxUses ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: 'COUPON_CREATED', resourceType: 'COUPON', resourceId: coupon.id });
  res.status(201).json({ success: true, message: 'Cupón creado', data: coupon });
};

export const deactivateCoupon = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  const coupon = await Coupon.findByPk(id);
  if (!coupon) throw createError('Cupón no encontrado', 404);
  if (!coupon.isActive) throw createError('El cupón ya está desactivado', 409);
  await coupon.update({ isActive: false });
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: 'COUPON_DEACTIVATED', resourceType: 'COUPON', resourceId: id });
  res.json({ success: true, message: 'Cupón desactivado' });
};
