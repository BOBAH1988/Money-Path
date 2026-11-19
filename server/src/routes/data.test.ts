import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type DbHandle } from '../db/index.js';
import { createTestApp, verifierReturning } from '../test-support.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const auth = (uid = 'u1') => ({
  'authorization': `Bearer ${uid}`,
  'content-type': 'application/json',
});

describeDb('routes /me/collections, budget_plan, sync, account (Postgres)', () => {
  let handle: DbHandle;
  const apps: FastifyInstance[] = [];

  const appFor = (uid = 'u1'): FastifyInstance => {
    const app = createTestApp(verifierReturning({ uid, email: `${uid}@example.com`, emailVerified: true }), handle.db);
    apps.push(app);
    return app;
  };

  beforeAll(async () => {
    handle = createDb(databaseUrl!);
    await migrate(handle.db, { migrationsFolder });
  });

  beforeEach(async () => {
    await handle.db.execute(
      sql`truncate table assets, liabilities, income, income_archive, budget_plan, profiles`,
    );
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('отдаёт пустой снимок с базовой dataVersion', async () => {
    const response = await appFor().inject({ method: 'GET', url: '/me/collections/income', headers: auth() });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ dataVersion: '1970-01-01T00:00:00.000Z', items: [] });
  });

  it('upsert и чтение записи', async () => {
    const app = appFor();

    const saved = await app.inject({
      method: 'PUT',
      url: '/me/collections/income/rec1',
      headers: auth(),
      payload: { id: 'rec1', name: 'Зарплата', amount: 100, monthly: 10 },
    });
    expect(saved.statusCode).toBe(204);

    const read = await app.inject({ method: 'GET', url: '/me/collections/income', headers: auth() });
    expect(read.statusCode).toBe(200);
    const body = read.json();
    expect(body.items).toEqual([{ id: 'rec1', name: 'Зарплата', amount: 100, monthly: 10 }]);
    expect(body.dataVersion > '1970-01-01T00:00:00.000Z').toBe(true);
  });

  it('не сохраняет лишние поля записи (аудит перед cutover)', async () => {
    await appFor().inject({
      method: 'PUT',
      url: '/me/collections/assets/rec1',
      headers: auth(),
      payload: { id: 'rec1', name: 'Квартира', amount: 1, monthly: 0, importBatchId: 'batch-1' },
    });

    const read = await appFor().inject({ method: 'GET', url: '/me/collections/assets', headers: auth() });
    expect(read.json().items[0]).toEqual({ id: 'rec1', name: 'Квартира', amount: 1, monthly: 0 });
  });

  it('архив доходов хранит 12 месяцев', async () => {
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    await appFor().inject({
      method: 'PUT',
      url: '/me/collections/income_archive/arch1',
      headers: auth(),
      payload: { id: 'arch1', name: 'Подработка', year: 2026, months },
    });

    const read = await appFor().inject({
      method: 'GET',
      url: '/me/collections/income_archive',
      headers: auth(),
    });
    expect(read.json().items).toEqual([{ id: 'arch1', name: 'Подработка', year: 2026, months }]);
  });

  it('отклоняет несовпадение id в пути и теле', async () => {
    const response = await appFor().inject({
      method: 'PUT',
      url: '/me/collections/income/rec1',
      headers: auth(),
      payload: { id: 'другой-id', name: 'x' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('удаляет запись и очищает коллекцию', async () => {
    const app = appFor();
    await app.inject({
      method: 'PUT',
      url: '/me/collections/income/rec1',
      headers: auth(),
      payload: { id: 'rec1', name: 'Зарплата', amount: 1, monthly: 0 },
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: '/me/collections/income/rec1',
      headers: auth(),
    });
    expect(removed.statusCode).toBe(204);

    const missing = await app.inject({
      method: 'DELETE',
      url: '/me/collections/income/rec1',
      headers: auth(),
    });
    expect(missing.statusCode).toBe(404);

    await app.inject({
      method: 'PUT',
      url: '/me/collections/income/rec2',
      headers: auth(),
      payload: { id: 'rec2', name: 'Бонус', amount: 2, monthly: 0 },
    });
    const cleared = await app.inject({
      method: 'DELETE',
      url: '/me/collections/income',
      headers: auth(),
    });
    expect(cleared.statusCode).toBe(204);

    const read = await app.inject({ method: 'GET', url: '/me/collections/income', headers: auth() });
    expect(read.json().items).toEqual([]);
  });

  it('сохраняет и читает план бюджета', async () => {
    const items = [{ id: 'b1', name: 'Еда', amount: 1, plan: 2, group: 'monthly', type: 'item' }];
    const app = appFor();

    const saved = await app.inject({
      method: 'PUT',
      url: '/me/budget_plan',
      headers: auth(),
      payload: { items, updatedAt: '2026-11-19T00:00:00.000Z' },
    });
    expect(saved.statusCode).toBe(204);

    const read = await app.inject({ method: 'GET', url: '/me/budget_plan', headers: auth() });
    expect(read.json()).toMatchObject({ items, updatedAt: '2026-11-19T00:00:00.000Z' });
  });

  it('применяет пакет операций sync по порядку', async () => {
    const response = await appFor().inject({
      method: 'POST',
      url: '/me/sync',
      headers: auth(),
      payload: {
        clientId: 'tab-1',
        operations: [
          { op: 'upsert', operationId: 'o1', collection: 'income', item: { id: 'r1', name: 'A', amount: 1, monthly: 0 } },
          { op: 'upsert', operationId: 'o2', collection: 'income', item: { id: 'r2', name: 'B', amount: 2, monthly: 0 } },
          { op: 'delete', operationId: 'o3', collection: 'income', itemId: 'r1' },
          { op: 'budget_plan', operationId: 'o4', items: [], updatedAt: '2026-11-19T00:00:00.000Z' },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().applied).toEqual([
      { operationId: 'o1', status: 'ok' },
      { operationId: 'o2', status: 'ok' },
      { operationId: 'o3', status: 'ok' },
      { operationId: 'o4', status: 'ok' },
    ]);

    const read = await appFor().inject({ method: 'GET', url: '/me/collections/income', headers: auth() });
    expect(read.json().items.map((item: { id: string }) => item.id)).toEqual(['r2']);
  });

  it('откатывает sync целиком при битой операции', async () => {
    const response = await appFor().inject({
      method: 'POST',
      url: '/me/sync',
      headers: auth(),
      payload: {
        clientId: 'tab-1',
        operations: [
          { op: 'upsert', operationId: 'o1', collection: 'income', item: { id: 'r1', name: 'A', amount: 1, monthly: 0 } },
          { op: 'upsert', operationId: 'o2', collection: 'income', item: { name: 'без id' } },
        ],
      },
    });

    expect(response.statusCode).toBe(422);

    const read = await appFor().inject({ method: 'GET', url: '/me/collections/income', headers: auth() });
    expect(read.json().items).toEqual([]);
  });

  it('не смешивает данные пользователей', async () => {
    await appFor('u1').inject({
      method: 'PUT',
      url: '/me/collections/income/rec1',
      headers: auth('u1'),
      payload: { id: 'rec1', name: 'Своё', amount: 1, monthly: 0 },
    });

    const readOther = await appFor('u2').inject({
      method: 'GET',
      url: '/me/collections/income',
      headers: auth('u2'),
    });
    expect(readOther.json().items).toEqual([]);

    const readOwner = await appFor('u1').inject({
      method: 'GET',
      url: '/me/collections/income',
      headers: auth('u1'),
    });
    expect(readOwner.json().items).toHaveLength(1);
  });

  it('удаляет все данные пользователя через DELETE /me', async () => {
    const app = appFor('u1');
    await app.inject({
      method: 'PUT',
      url: '/me/collections/income/rec1',
      headers: auth('u1'),
      payload: { id: 'rec1', name: 'A', amount: 1, monthly: 0 },
    });

    const removed = await app.inject({ method: 'DELETE', url: '/me', headers: auth('u1') });
    expect(removed.statusCode).toBe(204);

    const read = await app.inject({ method: 'GET', url: '/me/collections/income', headers: auth('u1') });
    expect(read.json().items).toEqual([]);

    const plan = await app.inject({ method: 'GET', url: '/me/budget_plan', headers: auth('u1') });
    expect(plan.json()).toEqual({ items: [], updatedAt: '' });
  });
});