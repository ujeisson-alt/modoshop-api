import { Request, Response } from 'express';
import { CheckoutService } from '../services/checkout.service';
import { CheckoutInput, ValidateCouponInput } from '../schemas/checkout.schema';

export const validateCoupon = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body as ValidateCouponInput;
  const preview = await CheckoutService.previewCoupon(req.user!.id, code);
  res.json({ success: true, message: 'Cupón válido', data: preview });
};

export const checkout = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as CheckoutInput;
  const result = await CheckoutService.processCheckout({ userId: req.user!.id, ...body });
  res.status(201).json({
    success: true,
    message: result.paymentStatus === 'PAID' ? 'Pedido confirmado y pagado' : `Pago rechazado: ${result.paymentMessage}`,
    data: { order: result.order, paymentStatus: result.paymentStatus },
  });
};
