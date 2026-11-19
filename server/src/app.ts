import Fastify, { type FastifyInstance } from 'fastify';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthGuard } from './auth-guard.js';
import type { TokenVerifier } from './auth.js';
import type { Database } from './db/index.js';
import { registerDataRoutes } from './routes/data.js';
import { registerProfileRoutes } from './routes/profile.js';
import {
  DEFAULT_SECURITY,
  registerHardening,
  registerRateLimit,
  securityFromEnv,
  type SecurityOptions,
} from './security.js';
import { parseAdminUids, type Env } from './config.js';

export interface AppOptions {
  logLevel: string;
  verifier: TokenVerifier;
  db?: Database | null;
  /** uid администраторов для `/admin/stats`; пусто — эндпоинт закрыт для всех. */
  adminUids?: string[];
  /** Периметр API: CORS, лимиты, размер тела. Не заданное берётся из `DEFAULT_SECURITY`. */
  security?: Partial<SecurityOptions>;
}

export const buildApp = ({
  logLevel,
  verifier,
  db = null,
  adminUids = [],
  security: overrides,
}: AppOptions): FastifyInstance => {
  const security: SecurityOptions = { ...DEFAULT_SECURITY, ...overrides };
  const app = Fastify({ logger: { level: logLevel }, bodyLimit: security.bodyLimit });

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

  registerHardening(app, security);
  registerAuthGuard(app, verifier);
  registerRateLimit(app, security);

  // Плагин лимитов навешивает обработчик на каждый маршрут в момент его регистрации
  // (`onRoute`), а загружается он позже, чем выполняется этот код. Поэтому маршруты
  // объявляются в `after`: к этому моменту плагин уже загружен и лимиты действуют.
  app.after(() => {
    app.get('/health', async () => ({ status: 'ok' }));

    registerProfileRoutes(app, db);
    registerDataRoutes(app, db);
    registerAdminRoutes(app, db, adminUids);
  });

  return app;
};

/**
 * Сборка приложения из окружения: единственное место, где переменные периметра
 * попадают в `buildApp`. Отдельная функция нужна, чтобы забытый `security`
 * (CORS, лимиты, размер тела молча остаются по умолчанию) ловился тестом.
 */
export const createAppForEnv = (
  env: Env,
  deps: { verifier: TokenVerifier; db?: Database | null },
): FastifyInstance =>
  buildApp({
    logLevel: env.LOG_LEVEL,
    verifier: deps.verifier,
    db: deps.db ?? null,
    adminUids: parseAdminUids(env.ADMIN_UIDS),
    security: securityFromEnv(env),
  });
