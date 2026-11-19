import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '../auth.js';
import type { Database } from '../db/index.js';
import {
  clearCollection,
  deleteItem,
  deleteUserData,
  readBudgetPlan,
  readCollection,
  readDataVersion,
  upsertItem,
  writeBudgetPlan,
  type CollectionName,
} from '../db/repos.js';
import {
  noDatabase,
  notFound,
  paramError,
  unauthenticated,
  validationError,
} from '../http.js';
import {
  archiveItemSchema,
  budgetPlanSchema,
  collectionSchema,
  itemSchema,
  syncRequestSchema,
  toArchiveItem,
  toItem,
  type ArchiveItemInput,
  type ItemInput,
} from '../validation.js';

class SyncOperationError extends Error {
  readonly index: number;

  constructor(index: number, reason: string) {
    super(reason);
    this.name = 'SyncOperationError';
    this.index = index;
  }
}

const userOf = (request: FastifyRequest): AuthUser | null => request.authUser;

const parseCollection = (request: FastifyRequest, reply: FastifyReply): CollectionName | null => {
  const params = request.params as { collection?: string };
  const parsed = collectionSchema.safeParse(params.collection);
  if (!parsed.success) {
    paramError(reply, `Неизвестная коллекция: ${params.collection ?? ''}`);
    return null;
  }
  return parsed.data;
};

export const registerDataRoutes = (app: FastifyInstance, db: Database | null): void => {
  app.get('/me/collections/:collection', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    const collection = parseCollection(request, reply);
    if (!collection) return reply;

    return db.transaction((tx) => readCollection(tx, user.uid, collection));
  });

  app.put('/me/collections/:collection/:id', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);

    const collection = parseCollection(request, reply);
    if (!collection) return reply;

    const params = request.params as { id: string };
    const schema = collection === 'income_archive' ? archiveItemSchema : itemSchema;
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error);
    if (parsed.data.id !== params.id) {
      return paramError(reply, 'id в теле запроса не совпадает с id в пути');
    }

    if (!db) return noDatabase(reply);

    await db.transaction(async (tx) => {
      if (collection === 'income_archive') {
        await upsertItem(tx, user.uid, collection, toArchiveItem(parsed.data as ArchiveItemInput));
      } else {
        await upsertItem(tx, user.uid, collection, toItem(parsed.data as ItemInput));
      }
    });

    return reply.code(204).send();
  });

  app.delete('/me/collections/:collection/:id', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    const collection = parseCollection(request, reply);
    if (!collection) return reply;

    const params = request.params as { id: string };
    const removed = await db.transaction((tx) => deleteItem(tx, user.uid, collection, params.id));
    if (!removed) return notFound(reply, 'Запись не найдена');
    return reply.code(204).send();
  });

  app.delete('/me/collections/:collection', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    const collection = parseCollection(request, reply);
    if (!collection) return reply;

    await db.transaction((tx) => clearCollection(tx, user.uid, collection));
    return reply.code(204).send();
  });

  app.get('/me/budget_plan', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    const plan = await db.transaction((tx) => readBudgetPlan(tx, user.uid));
    return plan ?? { items: [], updatedAt: '' };
  });

  app.put('/me/budget_plan', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);

    const parsed = budgetPlanSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!db) return noDatabase(reply);

    const updatedAt = parsed.data.updatedAt ? new Date(parsed.data.updatedAt) : new Date();
    await db.transaction((tx) => writeBudgetPlan(tx, user.uid, parsed.data.items, updatedAt));
    return reply.code(204).send();
  });

  app.post('/me/sync', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);

    const parsed = syncRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error);
    if (!db) return noDatabase(reply);

    try {
      return await db.transaction(async (tx) => {
        const applied: { operationId: string; status: 'ok' }[] = [];

        for (const [index, operation] of parsed.data.operations.entries()) {
          if (operation.op === 'upsert') {
            if (operation.collection === 'income_archive') {
              const item = archiveItemSchema.safeParse(operation.item);
              if (!item.success) throw new SyncOperationError(index, 'Некорректная запись архива');
              await upsertItem(tx, user.uid, operation.collection, toArchiveItem(item.data));
            } else {
              const item = itemSchema.safeParse(operation.item);
              if (!item.success) throw new SyncOperationError(index, 'Некорректная запись');
              await upsertItem(tx, user.uid, operation.collection, toItem(item.data));
            }
          } else if (operation.op === 'delete') {
            await deleteItem(tx, user.uid, operation.collection, operation.itemId);
          } else if (operation.op === 'clear') {
            await clearCollection(tx, user.uid, operation.collection);
          } else {
            const updatedAt = operation.updatedAt ? new Date(operation.updatedAt) : new Date();
            await writeBudgetPlan(tx, user.uid, operation.items, updatedAt);
          }

          applied.push({ operationId: operation.operationId ?? String(index), status: 'ok' });
        }

        return { dataVersion: await readDataVersion(tx, user.uid), applied };
      });
    } catch (error) {
      if (error instanceof SyncOperationError) {
        return reply.code(422).send({
          code: 'VALIDATION_ERROR',
          message: `Операция ${error.index + 1}: ${error.message}`,
        });
      }
      throw error;
    }
  });

  app.delete('/me', async (request, reply) => {
    const user = userOf(request);
    if (!user) return unauthenticated(reply);
    if (!db) return noDatabase(reply);

    await db.transaction((tx) => deleteUserData(tx, user.uid));
    return reply.code(204).send();
  });
};
