import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { getValidated } from '../middlewares/validate';
import { IdParam } from '../schemas/common.schema';
import { AdjustStockInput, CreateProductInput, ListProductsQuery, UpdateProductInput } from '../schemas/product.schema';
import { logActivity } from '../utils/activityLog';

export const listProducts = async (_req: Request, res: Response): Promise<void> => {
  const query = getValidated<ListProductsQuery>(res, 'query');
  const { items, meta } = await ProductService.list(query);
  res.json({ success: true, data: items, meta });
};

export const getProduct = async (_req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  res.json({ success: true, data: await ProductService.getById(id) });
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  const product = await ProductService.create(req.body as CreateProductInput);
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: 'PRODUCT_CREATED', resourceType: 'PRODUCT', resourceId: product.id });
  res.status(201).json({ success: true, message: 'Producto creado', data: product });
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  const product = await ProductService.update(id, req.body as UpdateProductInput);
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: 'PRODUCT_UPDATED', resourceType: 'PRODUCT', resourceId: id, metadata: { fields: Object.keys(req.body as object) } });
  res.json({ success: true, message: 'Producto actualizado', data: product });
};

export const deactivateProduct = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  await ProductService.deactivate(id);
  await logActivity({ userId: req.user!.id, userRole: 'ADMIN', action: 'PRODUCT_DEACTIVATED', resourceType: 'PRODUCT', resourceId: id });
  res.json({ success: true, message: 'Producto desactivado' });
};

export const getProductStock = async (_req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  res.json({ success: true, data: await ProductService.getStock(id) });
};

export const adjustProductStock = async (req: Request, res: Response): Promise<void> => {
  const { id } = getValidated<IdParam>(res, 'params');
  const input = req.body as AdjustStockInput;
  const result = await ProductService.adjustStock(id, input);
  await logActivity({
    userId: req.user!.id,
    userRole: 'ADMIN',
    action: 'STOCK_ADJUSTED',
    resourceType: 'STOCK',
    resourceId: result.variantId,
    metadata: { from: result.previousQuantity, to: result.quantity, reason: input.reason ?? null },
  });
  res.json({ success: true, message: 'Stock actualizado', data: result });
};
