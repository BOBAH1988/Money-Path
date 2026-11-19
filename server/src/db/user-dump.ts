import { sql } from 'drizzle-orm';
import type { Database } from './index.js';
import { assets, budgetPlan, income, incomeArchive, liabilities, profiles } from './schema.js';
import type { ArchiveRow, ItemRow } from './normalize.js';

export interface UserDump {
  uid: string;
  email: string;
  createdAt?: string;
  lastActive?: string;
  avatar?: string | null;
  assets: ItemRow[];
  liabilities: ItemRow[];
  income: ItemRow[];
  incomeArchive: ArchiveRow[];
  budgetPlan: { items: unknown[]; updatedAt: string } | null;
}

export interface ApplyResult {
  assets: number;
  liabilities: number;
  income: number;
  incomeArchive: number;
  budgetPlan: boolean;
}

const dateOrNow = (value?: string): Date => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type ItemTable = typeof assets | typeof liabilities | typeof income;

const upsertItemRows = async (
  tx: Tx,
  table: ItemTable,
  userId: string,
  rows: ItemRow[],
): Promise<number> => {
  if (rows.length === 0) return 0;
  await tx
    .insert(table as typeof assets)
    .values(rows.map((row) => ({ userId, ...row })))
    .onConflictDoUpdate({
      target: [table.userId, table.id],
      set: {
        name: sql`excluded.name`,
        amount: sql`excluded.amount`,
        monthly: sql`excluded.monthly`,
        updatedAt: sql`now()`,
      },
    });
  return rows.length;
};

/**
 * Переносит снимок одного пользователя. Идемпотентен: повторный запуск
 * с тем же снимком обновляет строки, но не создаёт дубликаты.
 */
export const applyUserDump = async (db: Database, dump: UserDump): Promise<ApplyResult> =>
  db.transaction(async (tx) => {
    const createdAt = dateOrNow(dump.createdAt);
    const lastActive = dateOrNow(dump.lastActive);

    await tx
      .insert(profiles)
      .values({
        uid: dump.uid,
        email: dump.email,
        createdAt,
        lastActive,
        avatar: dump.avatar ?? null,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: sql`excluded.email`,
          lastActive: sql`excluded.last_active`,
          avatar: sql`excluded.avatar`,
        },
      });

    const assetsCount = await upsertItemRows(tx, assets, dump.uid, dump.assets);
    const liabilitiesCount = await upsertItemRows(tx, liabilities, dump.uid, dump.liabilities);
    const incomeCount = await upsertItemRows(tx, income, dump.uid, dump.income);

    if (dump.incomeArchive.length > 0) {
      await tx
        .insert(incomeArchive)
        .values(dump.incomeArchive.map((row) => ({ userId: dump.uid, ...row })))
        .onConflictDoUpdate({
          target: [incomeArchive.userId, incomeArchive.id],
          set: {
            name: sql`excluded.name`,
            year: sql`excluded.year`,
            months: sql`excluded.months`,
            updatedAt: sql`now()`,
          },
        });
    }

    let savedBudgetPlan = false;
    if (dump.budgetPlan) {
      await tx
        .insert(budgetPlan)
        .values({
          userId: dump.uid,
          items: dump.budgetPlan.items,
          updatedAt: dateOrNow(dump.budgetPlan.updatedAt),
        })
        .onConflictDoUpdate({
          target: budgetPlan.userId,
          set: {
            items: sql`excluded.items`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      savedBudgetPlan = true;
    }

    return {
      assets: assetsCount,
      liabilities: liabilitiesCount,
      income: incomeCount,
      incomeArchive: dump.incomeArchive.length,
      budgetPlan: savedBudgetPlan,
    };
  });
