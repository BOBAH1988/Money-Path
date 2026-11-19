import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, verifierReturning } from './test-support.js';

const apps: FastifyInstance[] = [];

const createApp = (...args: Parameters<typeof createTestApp>): FastifyInstance => {
  const app = createTestApp(...args);
  apps.push(app);
  return app;
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('публичные и защищённые маршруты', () => {
  it('GET /health доступен без токена', async () => {
    const response = await createApp(verifierReturning({ uid: 'u1', email: null, emailVerified: true })).inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('без заголовка Authorization отвечает 401', async () => {
    const response = await createApp(verifierReturning({ uid: 'u1', email: null, emailVerified: true })).inject({
      method: 'GET',
      url: '/me/profile',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('отклоняет не-bearer схему авторизации', async () => {
    const response = await createApp(verifierReturning({ uid: 'u1', email: null, emailVerified: true })).inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('отклоняет отозванный токен', async () => {
    const revoked = Object.assign(new Error('id-token-revoked'), { code: 'auth/id-token-revoked' });
    const response = await createApp(verifierReturning(revoked)).inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer revoked-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('отклоняет неподтверждённую почту', async () => {
    const response = await createApp(
      verifierReturning({ uid: 'u1', email: 'user@example.com', emailVerified: false }),
    ).inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('валидный токен доходит до маршрута (без БД — 503)', async () => {
    const response = await createApp(verifierReturning({ uid: 'u1', email: 'user@example.com', emailVerified: true })).inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { email: 'user@example.com' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'INTERNAL' });
  });

  it('DELETE с заголовком json и без тела доходит до маршрута, а не падает на парсере', async () => {
    const response = await createApp(
      verifierReturning({ uid: 'u1', email: 'user@example.com', emailVerified: true }),
    ).inject({
      method: 'DELETE',
      url: '/me/collections/income/rec1',
      headers: { 'authorization': 'Bearer valid-token', 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'INTERNAL' });
  });

  it('не принимает uid из тела запроса', async () => {
    const response = await createApp(verifierReturning({ uid: 'u1', email: null, emailVerified: true })).inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { uid: 'другой-пользователь' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
