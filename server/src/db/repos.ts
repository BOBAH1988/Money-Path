import { sql } from 'drizzle-orm';
import type { Database } from './index.js';
import { assets, budgetPlan, income, incomeArchive, liabilities, profiles } from './schema.js';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export const COLLECTIONS = ['assets', 'liabilities', 'income', 'income_archive'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface Item {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export interface ArchiveItem {
  id: string;
  name: string;
  year: number;
  months: number[];
}

export interface Snapshot {
  dataVersion: string;
  items: (Item | ArchiveItem)[];
}

const EMPTY_VERSION = '1970-01-01T00:00:00.000Z';

const maxVersion = (rows: { updatedAt: Date }[]): string =>
  rows.reduce<string>((latest, row) => {
    const value = row.updatedAt.toISOString();
    return value > latest ? value : latest;
  }, EMPTY_VERSION);

const itemTable = (name: Exclude<CollectionName, 'income_archive'>) => {
  if (name === 'assets') return assets;
  if (name === 'liabilities') return liabilities;
  return income;
};

export const readCollection = async (
  tx: Tx,
  userId: string,
  name: CollectionName,
): Promise<Snapshot> => {
  if (name === 'income_archive') {
    const rows = await tx.select().from(incomeArchive).where(sql`user_id = ${userId}`);
    return {
      dataVersion: maxVersion(rows),
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        year: row.year,
        months: row.months,
      })),
    };
  }

  const table = itemTable(name) as typeof assets;
  const rows = await tx.select().from(table).where(sql`user_id = ${userId}`);
  return {
    dataVersion: maxVersion(rows),
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      monthly: row.monthly,
    })),
  };
};

export const upsertItem = async (
  tx: Tx,
  userId: string,
  name: CollectionName,
  item: Item | ArchiveItem,
): Promise<void> => {
  if (name === 'income_archive') {
    const archive = item as ArchiveItem;
    await tx
      .insert(incomeArchive)
      .values({
        userId,
        id: archive.id,
        name: archive.name,
        year: archive.year,
        months: archive.months,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [incomeArchive.userId, incomeArchive.id],
        set: {
          name: sql`excluded.name`,
          year: sql`excluded.year`,
          months: sql`excluded.months`,
          updatedAt: sql`now()`,
        },
      });
    return;
  }

  const row = item as Item;
  const table = itemTable(name) as typeof assets;
  await tx
    .insert(table)
    .values({
      userId,
      id: row.id,
      name: row.name,
      amount: row.amount,
      monthly: row.monthly,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [table.userId, table.id],
      set: {
        name: sql`excluded.name`,
        amount: sql`excluded.amount`,
        monthly: sql`excluded.monthly`,
        updatedAt: sql`now()`,
      },
    });
};

export const deleteItem = async (
  tx: Tx,
  userId: string,
  name: CollectionName,
  id: string,
): Promise<boolean> => {
  if (name === 'income_archive') {
    const deleted = await tx
      .delete(incomeArchive)
      .where(sql`user_id = ${userId} and id = ${id}`)
      .returning({ id: incomeArchive.id });
    return deleted.length > 0;
  }

  const table = itemTable(name) as typeof assets;
  const deleted = await tx
    .delete(table)
    .where(sql`user_id = ${userId} and id = ${id}`)
    .returning({ id: table.id });
  return deleted.length > 0;
};

export const clearCollection = async (
  tx: Tx,
  userId: string,
  name: CollectionName,
): Promise<void> => {
  const table = name === 'income_archive' ? incomeArchive : (itemTable(name) as typeof assets);
  await tx.delete(table as typeof incomeArchive).where(sql`user_id = ${userId}`);
};

export const readBudgetPlan = async (
  tx: Tx,
  userId: string,
): Promise<{ items: unknown[]; updatedAt: string } | null> => {
  const rows = await tx.select().from(budgetPlan).where(sql`user_id = ${userId}`);
  const row = rows[0];
  if (!row) return null;
  return { items: row.items, updatedAt: row.updatedAt.toISOString() };
};

export const writeBudgetPlan = async (
  tx: Tx,
  userId: string,
  items: unknown[],
  updatedAt: Date,
): Promise<void> => {
  await tx
    .insert(budgetPlan)
    .values({ userId, items, updatedAt })
    .onConflictDoUpdate({
      target: budgetPlan.userId,
      set: { items: sql`excluded.items`, updatedAt: sql`excluded.updated_at` },
    });
};

export const readDataVersion = async (tx: Tx, userId: string): Promise<string> => {
  const result = await tx.execute(sql`
    select max(v) as v from (
      select max(updated_at) as v from assets where user_id = ${userId}
      union all select max(updated_at) from liabilities where user_id = ${userId}
      union all select max(updated_at) from income where user_id = ${userId}
      union all select max(updated_at) from income_archive where user_id = ${userId}
      union all select max(updated_at) from budget_plan where user_id = ${userId}
    ) t
  `);
  const rows = (result as unknown as { rows: { v: Date | string | null }[] }).rows;
  const value = rows[0]?.v;
  if (!value) return EMPTY_VERSION;
  return value instanceof Date ? value.toISOString() : String(value);
};

export const deleteUserData = async (tx: Tx, userId: string): Promise<void> => {
  for (const table of [assets, liabilities, income, incomeArchive, budgetPlan]) {
    await tx.delete(table as typeof assets).where(sql`user_id = ${userId}`);
  }
  await tx.delete(profiles).where(sql`uid = ${userId}`);
};
