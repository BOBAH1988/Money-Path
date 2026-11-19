import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../config.js';
import { createDb } from '../db/index.js';

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error('DATABASE_URL не задан — миграции не применены');
  process.exit(1);
}

const { db, pool } = createDb(env.DATABASE_URL);
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

try {
  await migrate(db, { migrationsFolder });
  console.log('Миграции применены');
} catch (error) {
  console.error('Не удалось применить миграции:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
