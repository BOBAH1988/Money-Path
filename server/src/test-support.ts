import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { AuthUser, TokenVerifier } from './auth.js';
import type { Database } from './db/index.js';

/** Тестовый двойник верификатора: возвращает заданного пользователя или бросает заданную ошибку. */
export const verifierReturning = (user: AuthUser | Error): TokenVerifier => ({
  verify: async () => {
    if (user instanceof Error) throw user;
    return user;
  },
});

export const createTestApp = (verifier: TokenVerifier, db: Database | null = null): FastifyInstance =>
  buildApp({ logLevel: 'silent', verifier, db });
