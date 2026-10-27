import { Op, QueryTypes, WhereOptions, Order as SequelizeOrder } from 'sequelize';
import { sequelize } from '../config/database';
import { Category, Product, ProductVariant, Stock } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { AdjustStockInput, CreateProductInput, ListProductsQuery, UpdateProductInput } from '../schemas/product.schema';
import { buildMeta, getPagination } from '../utils/pagination';
import { round2 } from '../utils/money';
import { CartItem, PaginationMeta } from '../types';

export interface VariantView {
  id: number;
  sku: string;
  size: string | null;
  color: string | null;
  priceModifier: number;
  finalPrice: number;
  availableStock: number;
}

export interface ProductView {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  brand: string | null;
  images: string[];
  isActive: boolean;
  category: { id: number; name: string; slug: string } | null;
  variants: VariantView[];
  priceRange: { min: number; max: number };
  totalAvailable: number;
  createdAt: Date;
}

export const variantPrice = (product: Product, variant: ProductVariant): number =>
  round2(product.basePrice + variant.priceModifier);

const toView = (product: Product): ProductView => {
  const variants: VariantView[] = (product.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    priceModifier: v.priceModifier,
    finalPrice: variantPrice(product, v),
    availableStock: v.stock ? v.stock.available : 0,
  }));
  const prices = variants.map((v) => v.finalPrice);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    basePrice: product.basePrice,
    brand: product.brand,
    images: product.imagesJson ?? [],
    isActive: product.isActive,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    variants,
    priceRange: {
      min: prices.length ? Math.min(...prices) : product.basePrice,
      max: prices.length ? Math.max(...prices) : product.basePrice,
    },
    totalAvailable: variants.reduce((s, v) => s + v.availableStock, 0),
    createdAt: product.createdAt,
  };
};

const SORTS: Record<ListProductsQuery['sort'], SequelizeOrder> = {
  newest: [['createdAt', 'DESC']],
  price_asc: [['basePrice', 'ASC']],
  price_desc: [['basePrice', 'DESC']],
  name: [['name', 'ASC']],
};

export const ProductService = {
  async list(
    query: ListProductsQuery,
    includeInactive = false,
  ): Promise<{ items: ProductView[]; meta: PaginationMeta }> {
    const { page, limit, search, category, brand, size, color, minPrice, maxPrice, inStock, sort } = query;
    const where: WhereOptions = {};
    const and: WhereOptions[] = [];
    if (!includeInactive) and.push({ isActive: true });
    if (search) {
      and.push({ [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }] });
    }
    if (brand) and.push({ brand });
    if (minPrice !== undefined) and.push({ basePrice: { [Op.gte]: minPrice } });
    if (maxPrice !== undefined) and.push({ basePrice: { [Op.lte]: maxPrice } });

    if (category) {
      const isNumeric = /^\d+$/.test(category);
      const cat = await Category.findOne({ where: isNumeric ? { id: Number(category) } : { slug: category } });
      if (!cat) return { items: [], meta: buildMeta(page, limit, 0) };
      // Incluye subcategorías directas
      const children = await Category.findAll({ where: { parentId: cat.id }, attributes: ['id'] });
      and.push({ categoryId: { [Op.in]: [cat.id, ...children.map((c) => c.id)] } });
    }

    // Filtros por variante: se resuelven con un subquery para no romper la paginación
    if (size || color || inStock) {
      const variantWhere: string[] = [];
      const replacements: Record<string, string> = {};
      if (size) {
        variantWhere.push('pv.size = :size');
        replacements.size = size;
      }
      if (color) {
        variantWhere.push('pv.color = :color');
        replacements.color = color;
      }
      if (inStock) variantWhere.push('(s.quantity - s.reserved_quantity) > 0');
      const ids = await sequelize.query<{ product_id: number }>(
        `SELECT DISTINCT pv.product_id FROM product_variants pv
         LEFT JOIN stock s ON s.variant_id = pv.id
         WHERE ${variantWhere.join(' AND ')}`,
        { replacements, type: QueryTypes.SELECT },
      );
      and.push({ id: { [Op.in]: ids.map((r) => r.product_id) } });
    }

    Object.assign(where, { [Op.and]: and });
    const { offset } = getPagination(page, limit);
    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        {
          model: ProductVariant,
          as: 'variants',
          include: [{ model: Stock, as: 'stock' }],
        },
      ],
      order: [...(SORTS[sort] as [string, string][]), [{ model: ProductVariant, as: 'variants' }, 'id', 'ASC']],
      limit,
      offset,
      distinct: true,
    });
    return { items: rows.map(toView), meta: buildMeta(page, limit, count) };
  },

  async getById(id: number, includeInactive = false): Promise<ProductView> {
    const product = await Product.findByPk(id, {
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: ProductVariant, as: 'variants', include: [{ model: Stock, as: 'stock' }] },
      ],
      order: [[{ model: ProductVariant, as: 'variants' }, 'id', 'ASC']],
    });
    if (!product || (!product.isActive && !includeInactive)) throw createError('Producto no encontrado', 404);
    return toView(product);
  },

  async create(input: CreateProductInput): Promise<ProductView> {
    if (input.categoryId) {
      const category = await Category.findByPk(input.categoryId);
      if (!category) throw createError('La categoría no existe', 400);
    }
    const skus = input.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) throw createError('Hay SKUs repetidos en las variantes', 400);

    const productId = await sequelize.transaction(async (transaction) => {
      const product = await Product.create(
        {
          name: input.name,
          description: input.description ?? null,
          basePrice: input.basePrice,
          categoryId: input.categoryId ?? null,
          brand: input.brand ?? null,
          imagesJson: input.imagesJson ?? [],
        },
        { transaction },
      );
      for (const v of input.variants) {
        if (input.basePrice + v.priceModifier <= 0) {
          throw createError(`El precio final de la variante ${v.sku} debe ser mayor a 0`, 400);
        }
        const variant = await ProductVariant.create(
          {
            productId: product.id,
            size: v.size ?? null,
            color: v.color ?? null,
            sku: v.sku.toUpperCase(),
            priceModifier: v.priceModifier,
          },
          { transaction },
        );
        await Stock.create({ variantId: variant.id, quantity: v.initialStock }, { transaction });
      }
      return product.id;
    });
    return ProductService.getById(productId, true);
  },

  async update(id: number, input: UpdateProductInput): Promise<ProductView> {
    const product = await Product.findByPk(id);
    if (!product) throw createError('Producto no encontrado', 404);
    if (input.categoryId) {
      const category = await Category.findByPk(input.categoryId);
      if (!category) throw createError('La categoría no existe', 400);
    }
    await product.update(input);
    return ProductService.getById(id, true);
  },

  /** Soft delete: el producto deja de verse en el catálogo pero se conserva para el historial. */
  async deactivate(id: number): Promise<void> {
    const product = await Product.findByPk(id);
    if (!product) throw createError('Producto no encontrado', 404);
    if (!product.isActive) throw createError('El producto ya está desactivado', 409);
    await product.update({ isActive: false });
  },

  async getStock(productId: number) {
    const product = await Product.findByPk(productId, {
      include: [{ model: ProductVariant, as: 'variants', include: [{ model: Stock, as: 'stock' }] }],
      order: [[{ model: ProductVariant, as: 'variants' }, 'id', 'ASC']],
    });
    if (!product) throw createError('Producto no encontrado', 404);
    const variants = (product.variants ?? []).map((v) => ({
      variantId: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      quantity: v.stock?.quantity ?? 0,
      reservedQuantity: v.stock?.reservedQuantity ?? 0,
      available: v.stock?.available ?? 0,
      lastUpdated: v.stock?.lastUpdated ?? null,
    }));
    return {
      productId: product.id,
      productName: product.name,
      variants,
      totals: {
        quantity: variants.reduce((s, v) => s + v.quantity, 0),
        reserved: variants.reduce((s, v) => s + v.reservedQuantity, 0),
        available: variants.reduce((s, v) => s + v.available, 0),
      },
    };
  },

  async adjustStock(productId: number, input: AdjustStockInput) {
    return sequelize.transaction(async (transaction) => {
      const variant = await ProductVariant.findOne({ where: { id: input.variantId, productId }, transaction });
      if (!variant) throw createError('La variante no pertenece a este producto', 404);
      const [stock] = await Stock.findOrCreate({
        where: { variantId: variant.id },
        defaults: { variantId: variant.id, quantity: 0 },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const previous = stock.quantity;
      const next = input.quantity !== undefined ? input.quantity : previous + (input.delta ?? 0);
      if (next < 0) throw createError('El stock no puede quedar negativo', 400);
      if (next < stock.reservedQuantity) {
        throw createError(
          `No se puede bajar el stock a ${next}: hay ${stock.reservedQuantity} unidades reservadas por checkouts en curso`,
          409,
        );
      }
      await stock.update({ quantity: next }, { transaction });
      return {
        variantId: variant.id,
        sku: variant.sku,
        previousQuantity: previous,
        quantity: next,
        reservedQuantity: stock.reservedQuantity,
        available: next - stock.reservedQuantity,
      };
    });
  },

  /** Datos de una variante listos para guardar en el carrito (precio actual + stock disponible). */
  async getCartSnapshot(variantId: number, quantity: number): Promise<{ item: CartItem; available: number }> {
    const variant = await ProductVariant.findByPk(variantId, {
      include: [
        { model: Product, as: 'product' },
        { model: Stock, as: 'stock' },
      ],
    });
    if (!variant || !variant.product || !variant.product.isActive) {
      throw createError('Producto no encontrado', 404);
    }
    const product = variant.product;
    return {
      available: variant.stock ? variant.stock.available : 0,
      item: {
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        price: variantPrice(product, variant),
        quantity,
        ...(product.imagesJson && product.imagesJson[0] ? { imageUrl: product.imagesJson[0] } : {}),
      },
    };
  },
};
