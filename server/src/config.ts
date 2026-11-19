import { z } from 'zod';

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Список uid администраторов из `ADMIN_UIDS=uid1,uid2`; пустой список — доступа нет ни у кого. */
export const parseAdminUids = (value: string | undefined): string[] => list(value);

/** Разрешённые origin'ы из `CORS_ORIGINS=https://a.example,https://b.example`. */
export const parseOrigins = (value: string | undefined): string[] => list(value);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  ADMIN_UIDS: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) => parseOrigins(value)),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  BODY_LIMIT: z.coerce.number().int().min(1024).default(256 * 1024),
  TOKEN_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300_000),
  TOKEN_CACHE_MAX: z.coerce.number().int().min(1).default(5_000),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Некорректные переменные окружения: ${parsed.error.message}`);
  }
  return parsed.data;
};
