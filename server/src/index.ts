import 'dotenv/config';
import { buildApp } from './app.js';
import { createFirebaseVerifier } from './auth.js';
import { loadEnv } from './config.js';
import { createDb } from './db/index.js';

const env = loadEnv();
const verifier = createFirebaseVerifier({ projectId: env.FIREBASE_PROJECT_ID });
const handle = env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;

if (!handle) {
  console.warn('DATABASE_URL не задан: эндпоинты данных будут отвечать 503');
}

const app = buildApp({ logLevel: env.LOG_LEVEL, verifier, db: handle?.db ?? null });

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
