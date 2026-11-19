import { integer, jsonb, pgTable, primaryKey, text, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

/**
 * Решение: денежные суммы остаются double precision. Фронт и импорт из Excel уже
 * работают с float, бюджет личный — сверки до копейки нет. numeric(14,2) вернул бы
 * строки из node-postgres и потребовал менять формат на всём пути (транспорт, кэш, UI).
 * Если копеечная точность понадобится, это делается до боевого импорта: numeric(14,2)
 * плюс приведение к числу на границе репозитория и тесты округления.
 */
const money = (name: string) => doublePrecision(name).notNull().default(0);

const rowColumns = {
  userId: text('user_id').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull().default(''),
  amount: money('amount'),
  monthly: money('monthly'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const assets = pgTable(
  'assets',
  rowColumns,
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const liabilities = pgTable(
  'liabilities',
  rowColumns,
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const income = pgTable(
  'income',
  rowColumns,
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const incomeArchive = pgTable(
  'income_archive',
  {
    userId: text('user_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull().default(''),
    year: integer('year').notNull().default(0),
    months: jsonb('months').$type<number[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const budgetPlan = pgTable('budget_plan', {
  userId: text('user_id').primaryKey(),
  items: jsonb('items').$type<unknown[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActive: timestamp('last_active', { withTimezone: true }).notNull().defaultNow(),
  avatar: text('avatar'),
});

export const collectionTables = {
  assets,
  liabilities,
  income,
  income_archive: incomeArchive,
} as const;

export type CollectionName = keyof typeof collectionTables;
export type Schema = typeof import('./schema.js');
