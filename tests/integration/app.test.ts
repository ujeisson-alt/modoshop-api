import request from 'supertest';
import app from '../../src/app';
import { signToken } from '../../src/utils/jwt';
import { redis } from '../../src/config/redis';
import { sequelize } from '../../src/config/database';

const customerToken = signToken({ id: 2, role: 'CUSTOMER' });

afterAll(async () => {
  redis.disconnect();
  await sequelize.close();
});

describe('API — rutas y middlewares (sin base de datos)', () => {
  it('GET / devuelve el mensaje de bienvenida', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/ModoShop/);
  });

  it('aplica headers de seguridad con Helmet', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('responde 404 en rutas inexistentes', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('el carrito requiere token (401)', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('rechaza tokens inválidos (401)', async () => {
    const res = await request(app).get('/api/v1/cart').set('Authorization', 'Bearer token.falso.123');
    expect(res.status).toBe(401);
  });

  it('un CUSTOMER no puede crear productos (403)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Hack' });
    expect(res.status).toBe(403);
  });

  it('un CUSTOMER no puede ver reportes (403)', async () => {
    const res = await request(app).get('/api/v1/reports/sales').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('un CUSTOMER no puede ver el perfil de otro usuario (403)', async () => {
    const res = await request(app).get('/api/v1/users/99').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('valida el registro con Zod (400 con detalle por campo)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'A', email: 'no-es-email', password: '123' });
    expect(res.status).toBe(400);
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('valida el método de pago del checkout (400)', async () => {
    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentMethod: 'BITCOIN' });
    expect(res.status).toBe(400);
  });

  it('valida cantidades del carrito (400)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId: 101, quantity: -3 });
    expect(res.status).toBe(400);
  });

  it('responde 400 ante JSON mal formado', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });
});
