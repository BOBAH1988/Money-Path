import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  ADMIN_UIDS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Список uid администраторов из `ADMIN_UIDS=uid1,uid2`; пустой список — доступа нет ни у кого. */
export const parseAdminUids = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean);

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Некорректные переменные окружения: ${parsed.error.message}`);
  }
  return parsed.data;
};
