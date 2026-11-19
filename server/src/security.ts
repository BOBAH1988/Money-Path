import { createHash } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { AuthUser, TokenVerifier } from './auth.js';
import type { Env } from './config.js';

export interface SecurityOptions {
  /** Разрешённые origin'ы для браузера; пусто — cross-origin запросы запрещены. */
  corsOrigins: string[];
  /** Запросов на ключ (uid или IP) за окно. */
  rateLimitMax: number;
  rateLimitWindowMs: number;
  /** Максимальный размер тела запроса в байтах. */
  bodyLimit: number;
  /** Сколько живёт результат проверки токена; 0 — без кэша. */
  tokenCacheTtlMs: number;
  tokenCacheMax: number;
}

export const DEFAULT_SECURITY: SecurityOptions = {
  corsOrigins: [],
  rateLimitMax: 120,
  rateLimitWindowMs: 60_000,
  bodyLimit: 256 * 1024,
  tokenCacheTtlMs: 300_000,
  tokenCacheMax: 5_000,
};

export const securityFromEnv = (env: Env): SecurityOptions => ({
  corsOrigins: env.CORS_ORIGINS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  bodyLimit: env.BODY_LIMIT,
  tokenCacheTtlMs: env.TOKEN_CACHE_TTL_MS,
  tokenCacheMax: env.TOKEN_CACHE_MAX,
});

/**
 * Заголовки безопасности и CORS. Регистрируется до охранника авторизации:
 * предварительный OPTIONS-запрос браузера приходит без Authorization и должен
 * получать ответ от CORS, а не 401.
 */
export const registerHardening = (app: FastifyInstance, options: SecurityOptions): void => {
  app.register(helmet, { contentSecurityPolicy: false });

  app.register(cors, {
    origin: options.corsOrigins.length > 0 ? options.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 600,
  });
};

/**
 * Лимит запросов. Регистрируется после охранника авторизации, поэтому ключ —
 * uid для уже проверенных запросов и IP для остальных. Счётчики в памяти
 * процесса: при нескольких инстансах лимит действует на каждый отдельно.
 */
export const registerRateLimit = (app: FastifyInstance, options: SecurityOptions): void => {
  app.register(rateLimit, {
    global: true,
    max: options.rateLimitMax,
    timeWindow: options.rateLimitWindowMs,
    keyGenerator: (request) => request.authUser?.uid ?? request.ip,
    // Плагин ожидает ошибку: код состояния Fastify берёт из `statusCode`, а не из ответа.
    errorResponseBuilder: (_request, context) => {
      const error = new Error(
        `Слишком много запросов: повторите через ${Math.ceil(context.ttl / 1000)} с`,
      ) as Error & { code: string; statusCode: number };
      error.code = 'RATE_LIMITED';
      error.statusCode = context.statusCode;
      return error;
    },
  });
};

export interface TokenCacheOptions {
  ttlMs: number;
  max: number;
  now?: () => number;
}

/**
 * Кэш результатов проверки токена. Firebase с checkRevoked=true ходит к Google на
 * каждый запрос; без кэша один экран даёт десятки обращений.
 *
 * Плата: отозванная сессия продолжает работать до истечения TTL. По умолчанию
 * 5 минут — компромисс между нагрузкой и задержкой отзыва; 0 отключает кэш.
 * Ключ — SHA-256 токена, чтобы сырые токены не лежали в памяти процесса.
 */
export const cachedVerifier = (inner: TokenVerifier, options: TokenCacheOptions): TokenVerifier => {
  if (options.ttlMs <= 0) return inner;

  const now = options.now ?? Date.now;
  const cache = new Map<string, { user: AuthUser; expiresAt: number }>();

  const keyOf = (token: string): string =>
    createHash('sha256').update(token).digest('base64');

  return {
    async verify(token: string): Promise<AuthUser> {
      const key = keyOf(token);
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now()) return hit.user;

      const user = await inner.verify(token);

      const oldest = cache.keys().next();
      if (!oldest.done && cache.size >= options.max) cache.delete(oldest.value);
      cache.set(key, { user, expiresAt: now() + options.ttlMs });
      return user;
    },
  };
};
