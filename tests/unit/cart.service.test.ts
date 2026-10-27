import RedisMock from 'ioredis-mock';
import type Redis from 'ioredis';
import { cartKey, createCartService } from '../../src/services/cart.service';
import { CartItem } from '../../src/types';

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  variantId: 101,
  productId: 1,
  productName: 'Remera Oversize',
  sku: 'REM-OVS-M-NEG',
  size: 'M',
  color: 'Negro',
  price: 4500,
  quantity: 2,
  ...overrides,
});

describe('CartService (Redis Hash)', () => {
  let client: Redis;
  let cart: ReturnType<typeof createCartService>;
  const userId = 42;

  beforeEach(async () => {
    client = new RedisMock() as unknown as Redis;
    await client.flushall();
    cart = createCartService(client, 86400);
  });

  it('guarda cada item como campo del hash cart:{userId}', async () => {
    await cart.addItem(userId, item());
    const raw = await client.hget(cartKey(userId), '101');
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ variantId: 101, quantity: 2 });
  });

  it('suma la cantidad si el item ya existe', async () => {
    await cart.addItem(userId, item({ quantity: 2 }));
    await cart.addItem(userId, item({ quantity: 3 }));
    const items = await cart.getCart(userId);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });

  it('calcula subtotal e itemCount', async () => {
    await cart.addItem(userId, item({ variantId: 101, price: 4500, quantity: 2 }));
    await cart.addItem(userId, item({ variantId: 201, price: 18900, quantity: 1 }));
    expect(await cart.getCartTotal(userId)).toEqual({ subtotal: 27900, itemCount: 3 });
  });

  it('renueva el TTL en cada escritura', async () => {
    await cart.addItem(userId, item());
    await client.expire(cartKey(userId), 10);
    await cart.updateQuantity(userId, 101, 4);
    expect(await cart.getTtl(userId)).toBeGreaterThan(10);
  });

  it('cantidad 0 elimina el item', async () => {
    await cart.addItem(userId, item());
    await cart.updateQuantity(userId, 101, 0);
    expect(await cart.getCart(userId)).toEqual([]);
  });

  it('lanza 404 al actualizar un item inexistente', async () => {
    await expect(cart.updateQuantity(userId, 999, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('clearCart elimina la clave completa', async () => {
    await cart.addItem(userId, item());
    await cart.clearCart(userId);
    expect(await client.exists(cartKey(userId))).toBe(0);
  });

  it('aísla los carritos de distintos usuarios', async () => {
    await cart.addItem(1, item({ variantId: 101 }));
    await cart.addItem(2, item({ variantId: 202 }));
    expect((await cart.getCart(1)).map((i) => i.variantId)).toEqual([101]);
    expect((await cart.getCart(2)).map((i) => i.variantId)).toEqual([202]);
  });
});
