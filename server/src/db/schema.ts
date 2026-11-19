import { integer, jsonb, pgTable, primaryKey, text, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

/**
 * Денежные суммы хранятся как double precision: приложение работает с числами
 * из Excel и уже суммирует их во float. Переход на numeric — отдельное решение,
 * его нельзя делать молча при миграции.
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
