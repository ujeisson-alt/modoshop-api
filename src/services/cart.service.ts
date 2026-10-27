import type Redis from 'ioredis';
import { redis, CART_TTL } from '../config/redis';
import { CartItem } from '../types';
import { round2 } from '../utils/money';
import { createError } from '../middlewares/errorHandler';

export const cartKey = (userId: number): string => `cart:${userId}`;

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

/**
 * Carrito en Redis: un Hash por usuario (cart:{userId}), un campo por variantId y el item como JSON.
 * Cada escritura renueva el TTL: el carrito expira tras 24 h de inactividad.
 */
export const createCartService = (client: Redis, ttlSeconds: number) => {
  const service = {
    async getCart(userId: number): Promise<CartItem[]> {
      const data = await client.hgetall(cartKey(userId));
      return Object.values(data).map((raw) => JSON.parse(raw) as CartItem);
    },

    async getItem(userId: number, variantId: number): Promise<CartItem | null> {
      const raw = await client.hget(cartKey(userId), String(variantId));
      return raw ? (JSON.parse(raw) as CartItem) : null;
    },

    /** Agrega un item; si ya existe, suma la cantidad. Devuelve el item resultante. */
    async addItem(userId: number, item: CartItem): Promise<CartItem> {
      const key = cartKey(userId);
      const existing = await service.getItem(userId, item.variantId);
      const merged: CartItem = existing ? { ...item, quantity: existing.quantity + item.quantity } : item;
      await client.multi().hset(key, String(item.variantId), JSON.stringify(merged)).expire(key, ttlSeconds).exec();
      return merged;
    },

    /** Actualiza la cantidad. Cantidad 0 elimina el item. */
    async updateQuantity(userId: number, variantId: number, quantity: number): Promise<CartItem | null> {
      const key = cartKey(userId);
      if (quantity <= 0) {
        await service.removeItem(userId, variantId);
        return null;
      }
      const existing = await service.getItem(userId, variantId);
      if (!existing) throw createError('Item no encontrado en el carrito', 404);
      const updated: CartItem = { ...existing, quantity };
      await client.multi().hset(key, String(variantId), JSON.stringify(updated)).expire(key, ttlSeconds).exec();
      return updated;
    },

    async removeItem(userId: number, variantId: number): Promise<boolean> {
      const key = cartKey(userId);
      const removed = await client.hdel(key, String(variantId));
      if (removed > 0) await client.expire(key, ttlSeconds);
      return removed > 0;
    },

    async getCartTotal(userId: number): Promise<{ subtotal: number; itemCount: number }> {
      const items = await service.getCart(userId);
      return summarize(items);
    },

    async getSummary(userId: number): Promise<CartSummary> {
      const items = await service.getCart(userId);
      return { items, ...summarize(items) };
    },

    async getTtl(userId: number): Promise<number> {
      return client.ttl(cartKey(userId));
    },

    /** Limpia el carrito (al completar el checkout). */
    async clearCart(userId: number): Promise<void> {
      await client.del(cartKey(userId));
    },
  };
  return service;
};

export const summarize = (items: CartItem[]): { subtotal: number; itemCount: number } => ({
  subtotal: round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0)),
  itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
});

export type CartServiceType = ReturnType<typeof createCartService>;
export const CartService = createCartService(redis, CART_TTL);
