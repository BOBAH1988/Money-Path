import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, createAppForEnv } from './app.js';
import type { AuthUser, TokenVerifier } from './auth.js';
import { loadEnv } from './config.js';
import { cachedVerifier, type SecurityOptions } from './security.js';
import { verifierReturning } from './test-support.js';

const user: AuthUser = { uid: 'u1', email: 'user@example.com', emailVerified: true };

const apps: FastifyInstance[] = [];

const createApp = (
  security: Partial<SecurityOptions> = {},
  verifier: TokenVerifier = verifierReturning(user),
): FastifyInstance => {
  const app = buildApp({ logLevel: 'silent', verifier, security });
  apps.push(app);
  return app;
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('периметр HTTP', () => {
  it('добавляет заголовки безопасности', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('пропускает предварительный запрос с разрешённого origin', async () => {
    const app = createApp({ corsOrigins: ['https://app.example'] });
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { 'origin': 'https://app.example', 'access-control-request-method': 'GET' },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.example');
  });

  it('не отдаёт CORS-заголовки чужому origin', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('ограничивает частоту запросов', async () => {
    const app = createApp({ rateLimitMax: 2, rateLimitWindowMs: 60_000 });

    const first = await app.inject({ method: 'GET', url: '/health' });
    const second = await app.inject({ method: 'GET', url: '/health' });
    const third = await app.inject({ method: 'GET', url: '/health' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(third.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('отклоняет слишком большое тело запроса', async () => {
    const app = createApp({ bodyLimit: 2048 });
    const response = await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { email: 'x'.repeat(4096) },
    });

    expect(response.statusCode).toBe(413);
  });

  it('берёт периметр из переменных окружения', async () => {
    const env = loadEnv({
      LOG_LEVEL: 'fatal',
      CORS_ORIGINS: 'https://app.example',
      RATE_LIMIT_MAX: '2',
      RATE_LIMIT_WINDOW_MS: '60000',
    });
    const app = createAppForEnv(env, { verifier: verifierReturning(user) });
    apps.push(app);

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { 'origin': 'https://app.example', 'access-control-request-method': 'GET' },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('https://app.example');

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(429);
  });
});

describe('кэш проверки токена', () => {
  const counting = (): TokenVerifier & { calls: number } => {
    const verifier = {
      calls: 0,
      async verify(): Promise<AuthUser> {
        verifier.calls += 1;
        return user;
      },
    };
    return verifier;
  };

  it('повторная проверка того же токена не обращается к источнику', async () => {
    const inner = counting();
    const verifier = cachedVerifier(inner, { ttlMs: 60_000, max: 10 });

    await verifier.verify('token-a');
    await verifier.verify('token-a');

    expect(inner.calls).toBe(1);
  });

  it('различает разные токены', async () => {
    const inner = counting();
    const verifier = cachedVerifier(inner, { ttlMs: 60_000, max: 10 });

    await verifier.verify('token-a');
    await verifier.verify('token-b');

    expect(inner.calls).toBe(2);
  });

  it('после истечения TTL проверяет заново', async () => {
    let now = 1_000;
    const inner = counting();
    const verifier = cachedVerifier(inner, { ttlMs: 1_000, max: 10, now: () => now });

    await verifier.verify('token-a');
    now += 500;
    await verifier.verify('token-a');
    expect(inner.calls).toBe(1);

    now += 600;
    await verifier.verify('token-a');
    expect(inner.calls).toBe(2);
  });

  it('TTL 0 отключает кэш', async () => {
    const inner = counting();
    const verifier = cachedVerifier(inner, { ttlMs: 0, max: 10 });

    await verifier.verify('token-a');
    await verifier.verify('token-a');

    expect(inner.calls).toBe(2);
  });

  it('не кэширует ошибку проверки', async () => {
    let calls = 0;
    const inner: TokenVerifier = {
      async verify() {
        calls += 1;
        if (calls === 1) throw new Error('id-token-expired');
        return user;
      },
    };
    const verifier = cachedVerifier(inner, { ttlMs: 60_000, max: 10 });

    await expect(verifier.verify('token-a')).rejects.toThrow('id-token-expired');
    await expect(verifier.verify('token-a')).resolves.toEqual(user);
    expect(calls).toBe(2);
  });

  it('вытесняет старейшую запись при переполнении', async () => {
    const inner = counting();
    const verifier = cachedVerifier(inner, { ttlMs: 60_000, max: 2 });

    await verifier.verify('token-a');
    await verifier.verify('token-b');
    await verifier.verify('token-c');
    expect(inner.calls).toBe(3);

    await verifier.verify('token-c');
    expect(inner.calls).toBe(3);

    await verifier.verify('token-a');
    expect(inner.calls).toBe(4);
  });
});
