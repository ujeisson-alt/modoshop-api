import { Request, Response } from 'express';
import { CartService } from '../services/cart.service';
import { ProductService } from '../services/product.service';
import { createError } from '../middlewares/errorHandler';
import { getValidated } from '../middlewares/validate';
import { AddToCartInput, UpdateCartItemInput } from '../schemas/cart.schema';
import { VariantIdParam } from '../schemas/common.schema';

const respondWithCart = async (userId: number, res: Response, status = 200, message?: string): Promise<void> => {
  const summary = await CartService.getSummary(userId);
  const expiresIn = await CartService.getTtl(userId);
  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data: { ...summary, expiresInSeconds: expiresIn > 0 ? expiresIn : null },
  });
};

export const getCart = async (req: Request, res: Response): Promise<void> => {
  await respondWithCart(req.user!.id, res);
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { variantId, quantity } = req.body as AddToCartInput;
  const { item, available } = await ProductService.getCartSnapshot(variantId, quantity);
  const inCart = (await CartService.getItem(userId, variantId))?.quantity ?? 0;
  if (available < inCart + quantity) {
    throw createError(
      available === 0
        ? 'Producto sin stock disponible'
        : `Solo quedan ${available} unidades disponibles${inCart ? ` (ya tenés ${inCart} en el carrito)` : ''}`,
      409,
      { variantId, available, inCart },
    );
  }
  await CartService.addItem(userId, item);
  await respondWithCart(userId, res, 201, 'Producto agregado al carrito');
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { variantId } = getValidated<VariantIdParam>(res, 'params');
  const { quantity } = req.body as UpdateCartItemInput;
  if (quantity > 0) {
    const existing = await CartService.getItem(userId, variantId);
    if (!existing) throw createError('Item no encontrado en el carrito', 404);
    const { available } = await ProductService.getCartSnapshot(variantId, quantity);
    if (available < quantity) {
      throw createError(`Solo quedan ${available} unidades disponibles`, 409, { variantId, available });
    }
  }
  await CartService.updateQuantity(userId, variantId, quantity);
  await respondWithCart(userId, res, 200, quantity === 0 ? 'Item eliminado del carrito' : 'Cantidad actualizada');
};

export const removeCartItem = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { variantId } = getValidated<VariantIdParam>(res, 'params');
  const removed = await CartService.removeItem(userId, variantId);
  if (!removed) throw createError('Item no encontrado en el carrito', 404);
  await respondWithCart(userId, res, 200, 'Item eliminado del carrito');
};

export const clearCart = async (req: Request, res: Response): Promise<void> => {
  await CartService.clearCart(req.user!.id);
  res.json({ success: true, message: 'Carrito vaciado', data: { items: [], subtotal: 0, itemCount: 0 } });
};
