import { buildApp } from './app.js';
import { loadEnv } from './config.js';

const env = loadEnv();
const app = buildApp({ logLevel: env.LOG_LEVEL });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'Останавливаю сервер');
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
