import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '../auth.js';
import type { Database } from '../db/index.js';
import { profiles } from '../db/schema.js';

const profileInput = z
  .object({
    email: z.email().optional(),
    avatar: z.string().nullable().optional(),
  })
  .strict();

type ProfileRow = typeof profiles.$inferSelect;

const toProfile = (row: ProfileRow) => ({
  uid: row.uid,
  email: row.email,
  createdAt: row.createdAt.toISOString(),
  lastActive: row.lastActive.toISOString(),
  avatar: row.avatar,
});

const unauthenticated = (reply: FastifyReply) =>
  reply.code(401).send({ code: 'UNAUTHENTICATED', message: 'Требуется авторизация' });

const noDatabase = (reply: FastifyReply) =>
  reply.code(503).send({ code: 'INTERNAL', message: 'База данных не настроена' });

const requireUser = (request: FastifyRequest): AuthUser | null => request.authUser;

export const registerProfileRoutes = (app: FastifyInstance, db: Database | null): void => {
  app.get('/me/profile', async (request, reply) => {
    const user = requireUser(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    const existing = await db.select().from(profiles).where(eq(profiles.uid, user.uid));
    if (existing[0]) return toProfile(existing[0]);

    const inserted = await db
      .insert(profiles)
      .values({ uid: user.uid, email: user.email ?? '' })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) return toProfile(inserted[0]);

    const again = await db.select().from(profiles).where(eq(profiles.uid, user.uid));
    if (!again[0]) {
      return reply.code(500).send({ code: 'INTERNAL', message: 'Не удалось создать профиль' });
    }
    return toProfile(again[0]);
  });

  app.put('/me/profile', async (request, reply) => {
    const user = requireUser(request);
    if (!user) return unauthenticated(reply);

    const parsed = profileInput.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Некорректное тело запроса',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    if (!db) return noDatabase(reply);

    const email = parsed.data.email ?? user.email ?? '';
    const avatar = parsed.data.avatar;

    // avatar === undefined — поле не прислали, существующее значение не трогаем;
    // avatar === null — осознанное удаление.
    const update =
      avatar === undefined
        ? { email: sql`excluded.email`, lastActive: sql`now()` }
        : { email: sql`excluded.email`, avatar: sql`excluded.avatar`, lastActive: sql`now()` };

    await db
      .insert(profiles)
      .values({ uid: user.uid, email, avatar: avatar ?? null, lastActive: new Date() })
      .onConflictDoUpdate({ target: profiles.uid, set: update });

    return reply.code(204).send();
  });
};
