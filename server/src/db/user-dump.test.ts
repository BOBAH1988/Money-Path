import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type DbHandle } from './index.js';
import { assets, budgetPlan, incomeArchive, profiles } from './schema.js';
import { applyUserDump, type UserDump } from './user-dump.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const makeDump = (overrides: Partial<UserDump> = {}): UserDump => ({
  uid: 'u1',
  email: 'user@example.com',
  createdAt: '2025-01-01T00:00:00.000Z',
  lastActive: '2025-06-01T00:00:00.000Z',
  avatar: null,
  assets: [{ id: 'a1', name: 'Квартира', amount: 100, monthly: 10 }],
  liabilities: [{ id: 'l1', name: 'Ипотека', amount: 50, monthly: 5 }],
  income: [],
  incomeArchive: [{ id: 'r1', name: 'Зарплата', year: 2025, months: new Array<number>(12).fill(1) }],
  budgetPlan: { items: [{ id: 'b1', name: 'Еда', amount: 1, plan: 2, group: 'monthly', type: 'item' }], updatedAt: '2025-06-01T00:00:00.000Z' },
  ...overrides,
});

describeDb('applyUserDump (Postgres)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = createDb(databaseUrl!);
    await migrate(handle.db, { migrationsFolder });
  });

  beforeEach(async () => {
    await handle.db.execute(
      sql`truncate table assets, liabilities, income, income_archive, budget_plan, profiles`,
    );
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('переносит снимок и профиль', async () => {
    const result = await applyUserDump(handle.db, makeDump());

    expect(result).toEqual({
      assets: 1,
      liabilities: 1,
      income: 0,
      incomeArchive: 1,
      budgetPlan: true,
    });

    const assetRows = await handle.db.select().from(assets);
    expect(assetRows).toHaveLength(1);
    expect(assetRows[0]).toMatchObject({ userId: 'u1', id: 'a1', name: 'Квартира', amount: 100 });

    const profileRows = await handle.db.select().from(profiles);
    expect(profileRows[0]).toMatchObject({ uid: 'u1', email: 'user@example.com' });
  });

  it('повторный запуск с тем же снимком не создаёт дубликаты', async () => {
    await applyUserDump(handle.db, makeDump());
    await applyUserDump(handle.db, makeDump());

    const assetRows = await handle.db.select().from(assets);
    const archiveRows = await handle.db.select().from(incomeArchive);
    const planRows = await handle.db.select().from(budgetPlan);

    expect(assetRows).toHaveLength(1);
    expect(archiveRows).toHaveLength(1);
    expect(planRows).toHaveLength(1);
  });

  it('повторный запуск обновляет изменённые поля', async () => {
    await applyUserDump(handle.db, makeDump());
    await applyUserDump(
      handle.db,
      makeDump({ assets: [{ id: 'a1', name: 'Квартира на Пресне', amount: 120, monthly: 12 }] }),
    );

    const assetRows = await handle.db.select().from(assets);
    expect(assetRows).toHaveLength(1);
    expect(assetRows[0]).toMatchObject({ name: 'Квартира на Пресне', amount: 120, monthly: 12 });
  });

  it('не смешивает данные разных пользователей с одинаковыми id', async () => {
    await applyUserDump(handle.db, makeDump());
    await applyUserDump(handle.db, makeDump({ uid: 'u2', email: 'second@example.com' }));

    const assetRows = await handle.db.select().from(assets);
    expect(assetRows).toHaveLength(2);
    expect(assetRows.map((row) => row.userId).sort()).toEqual(['u1', 'u2']);
  });
});
