import Fastify, { type FastifyInstance } from 'fastify';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthGuard } from './auth-guard.js';
import type { TokenVerifier } from './auth.js';
import type { Database } from './db/index.js';
import { registerDataRoutes } from './routes/data.js';
import { registerProfileRoutes } from './routes/profile.js';

export interface AppOptions {
  logLevel: string;
  verifier: TokenVerifier;
  db?: Database | null;
  /** uid администраторов для `/admin/stats`; пусто — эндпоинт закрыт для всех. */
  adminUids?: string[];
}

export const buildApp = ({
  logLevel,
  verifier,
  db = null,
  adminUids = [],
}: AppOptions): FastifyInstance => {
  const app = Fastify({ logger: { level: logLevel } });

  // Пустое тело при `content-type: application/json` — это отсутствие тела, а не ошибка
  // клиента: DELETE и повторные запросы часто приходят с общим заголовком и без payload.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body.trim() : '';
    if (text === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  registerAuthGuard(app, verifier);

  app.get('/health', async () => ({ status: 'ok' }));

  registerProfileRoutes(app, db);
  registerDataRoutes(app, db);
  registerAdminRoutes(app, db, adminUids);

  return app;
};
