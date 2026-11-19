import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { readUserStats } from '../db/repos.js';
import { forbidden, noDatabase, unauthenticated } from '../http.js';

/**
 * Админская аналитика: только агрегаты по профилям.
 * Список пользователей с почтами наружу не отдаётся — клиенту он и не нужен.
 */
export const registerAdminRoutes = (
  app: FastifyInstance,
  db: Database | null,
  adminUids: string[],
): void => {
  app.get('/admin/stats', async (request, reply) => {
    const user = request.authUser;
    if (!user) return unauthenticated(reply);
    if (!adminUids.includes(user.uid)) return forbidden(reply);
    if (!db) return noDatabase(reply);

    return db.transaction((tx) => readUserStats(tx));
  });
};
