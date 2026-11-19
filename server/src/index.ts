import 'dotenv/config';
import { createAppForEnv } from './app.js';
import { createFirebaseVerifier } from './auth.js';
import { loadEnv, parseAdminUids } from './config.js';
import { createDb } from './db/index.js';
import { cachedVerifier, securityFromEnv } from './security.js';

const env = loadEnv();
const security = securityFromEnv(env);
const verifier = cachedVerifier(createFirebaseVerifier({ projectId: env.FIREBASE_PROJECT_ID }), {
  ttlMs: security.tokenCacheTtlMs,
  max: security.tokenCacheMax,
});
const handle = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;

if (!handle) {
  console.warn('DATABASE_URL не задан: эндпоинты данных будут отвечать 503');
}

const adminUids = parseAdminUids(env.ADMIN_UIDS);
if (adminUids.length === 0) {
  console.warn('ADMIN_UIDS не задан: /admin/stats будет отвечать 403');
}

const app = createAppForEnv(env, { verifier, db: handle?.db ?? null });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'Останавливаю сервер');
    void app
      .close()
      .then(() => handle?.pool.end())
      .finally(() => process.exit(0));
  });
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  await handle?.pool.end();
  process.exit(1);
}
