import { toArchiveRow, toItemRow, type ArchiveRow, type ItemRow } from './normalize.js';

export interface RawDoc {
  id: string;
  data: Record<string, unknown>;
}

/** Сырой снимок одного пользователя из Firestore — ровно то, что читает импорт. */
export interface FirestoreUser {
  profile: Record<string, unknown> | null;
  assets: RawDoc[];
  liabilities: RawDoc[];
  income: RawDoc[];
  incomeArchive: RawDoc[];
  budgetPlan: { items: unknown[]; updatedAt: string } | null;
}

/** То же, что лежит в Postgres после импорта. */
export interface DbUser {
  profile: {
    email: string;
    createdAt: Date;
    lastActive: Date;
    avatar: string | null;
    acceptedTermsVersion: string | null;
    acceptedPrivacyVersion: string | null;
    consentUpdatedAt: Date | null;
  } | null;
  assets: ItemRow[];
  liabilities: ItemRow[];
  income: ItemRow[];
  incomeArchive: ArchiveRow[];
  budgetPlan: { items: unknown[]; updatedAt: Date } | null;
}

export type DiffKind = 'missing' | 'extra' | 'changed' | 'unknown-field';

export interface Difference {
  kind: DiffKind;
  collection: string;
  id?: string;
  field?: string;
  message: string;
}

export interface CompareOptions {
  uid?: string;
  now?: Date;
}

/**
 * Поля, которые импорт сохраняет: часть — в одноимённые колонки, часть — в
 * служебные (`id` из имени документа, `userId` — из uid, `updatedAt` — время
 * импорта). Всё остальное считается несохранённым.
 */
const ITEM_KNOWN = ['id', 'userId', 'updatedAt', 'name', 'amount', 'monthly'];
const ARCHIVE_KNOWN = ['id', 'userId', 'updatedAt', 'name', 'year', 'months', 'amount', 'monthly'];
const PROFILE_KNOWN = [
  'uid',
  'email',
  'createdAt',
  'lastActive',
  'avatar',
  'acceptedTermsVersion',
  'acceptedPrivacyVersion',
  'consentUpdatedAt',
];
const PLAN_KNOWN = ['items', 'updatedAt'];

const iso = (value: unknown): number | null => {
  if (typeof value !== 'string' || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

/** Сравнение без учёта порядка ключей: jsonb в Postgres переставляет ключи объектов. */
const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
  );
};

const unknownFields = (collection: string, doc: RawDoc, known: string[]): Difference[] =>
  Object.keys(doc.data)
    .filter((field) => !known.includes(field))
    .map((field) => ({
      kind: 'unknown-field' as const,
      collection,
      id: doc.id,
      field,
      message: `поле «${field}» есть в Firestore, но не хранится в Postgres (${typeof doc.data[field]})`,
    }));

/** Служебные поля документа должны совпадать с тем, что импорт записал в колонки. */
const structuralDiffs = (collection: string, doc: RawDoc, uid?: string): Difference[] => {
  const diffs: Difference[] = [];
  const dataId = doc.data.id;
  if (typeof dataId === 'string' && dataId !== doc.id) {
    diffs.push({
      kind: 'changed',
      collection,
      id: doc.id,
      field: 'id',
      message: `в документе id=${JSON.stringify(dataId)}, импорт взял имя документа`,
    });
  }

  const dataUid = doc.data.userId;
  if (uid && typeof dataUid === 'string' && dataUid !== uid) {
    diffs.push({
      kind: 'changed',
      collection,
      id: doc.id,
      field: 'userId',
      message: `в документе userId=${JSON.stringify(dataUid)}, ожидался ${uid}`,
    });
  }

  return diffs;
};

const compareById = <TRow extends { id: string }>(
  collection: string,
  expected: TRow[],
  actual: TRow[],
  fields: (keyof TRow)[],
): Difference[] => {
  const diffs: Difference[] = [];
  const actualById = new Map(actual.map((row) => [row.id, row]));
  const expectedIds = new Set(expected.map((row) => row.id));

  for (const want of expected) {
    const got = actualById.get(want.id);
    if (!got) {
      diffs.push({
        kind: 'missing',
        collection,
        id: want.id,
        message: 'запись есть в Firestore, но отсутствует в Postgres',
      });
      continue;
    }
    for (const field of fields) {
      if (!deepEqual(want[field], got[field])) {
        diffs.push({
          kind: 'changed',
          collection,
          id: want.id,
          field: String(field),
          message: `Firestore: ${JSON.stringify(want[field])}, Postgres: ${JSON.stringify(got[field])}`,
        });
      }
    }
  }

  for (const extra of actual) {
    if (!expectedIds.has(extra.id)) {
      diffs.push({
        kind: 'extra',
        collection,
        id: extra.id,
        message: 'запись есть в Postgres, но отсутствует в Firestore',
      });
    }
  }

  return diffs;
};

const compareProfile = (
  raw: Record<string, unknown> | null,
  db: DbUser['profile'],
  uid?: string,
): Difference[] => {
  if (!raw && !db) return [];
  if (!raw) {
    return [{ kind: 'extra', collection: 'profiles', message: 'профиль есть в Postgres, но не в Firestore' }];
  }
  if (!db) {
    return [{ kind: 'missing', collection: 'profiles', message: 'профиль есть в Firestore, но не в Postgres' }];
  }

  const diffs: Difference[] = [];

  if (uid && typeof raw.uid === 'string' && raw.uid !== uid) {
    diffs.push({
      kind: 'changed',
      collection: 'profiles',
      field: 'uid',
      message: `в документе uid=${JSON.stringify(raw.uid)}, ожидался ${uid}`,
    });
  }

  const expectedEmail = typeof raw.email === 'string' ? raw.email : '';
  if (expectedEmail !== db.email) {
    diffs.push({
      kind: 'changed',
      collection: 'profiles',
      field: 'email',
      message: `Firestore: ${JSON.stringify(expectedEmail)}, Postgres: ${JSON.stringify(db.email)}`,
    });
  }

  const expectedAvatar = typeof raw.avatar === 'string' ? raw.avatar : null;
  if (expectedAvatar !== db.avatar) {
    diffs.push({
      kind: 'changed',
      collection: 'profiles',
      field: 'avatar',
      message: 'значение аватара различается',
    });
  }

  for (const [field, actual] of [
    ['acceptedTermsVersion', db.acceptedTermsVersion],
    ['acceptedPrivacyVersion', db.acceptedPrivacyVersion],
  ] as const) {
    const expected = typeof raw[field] === 'string' ? raw[field] : null;
    if (expected !== actual) {
      diffs.push({
        kind: 'changed',
        collection: 'profiles',
        field,
        message: `Firestore: ${JSON.stringify(expected)}, Postgres: ${JSON.stringify(actual)}`,
      });
    }
  }

  const expectedConsent = iso(raw.consentUpdatedAt);
  if (expectedConsent !== (db.consentUpdatedAt?.getTime() ?? null)) {
    diffs.push({
      kind: 'changed',
      collection: 'profiles',
      field: 'consentUpdatedAt',
      message: `Firestore: ${raw.consentUpdatedAt ?? 'null'}, Postgres: ${db.consentUpdatedAt?.toISOString() ?? 'null'}`,
    });
  }

  // Если в Firestore даты нет, импорт подставил текущее время — сравнивать нечего.
  for (const [field, actual] of [
    ['createdAt', db.createdAt],
    ['lastActive', db.lastActive],
  ] as const) {
    const expected = iso(raw[field]);
    if (expected !== null && expected !== actual.getTime()) {
      diffs.push({
        kind: 'changed',
        collection: 'profiles',
        field,
        message: `Firestore: ${new Date(expected).toISOString()}, Postgres: ${actual.toISOString()}`,
      });
    }
  }

  return diffs;
};

const compareBudgetPlan = (
  raw: FirestoreUser['budgetPlan'],
  db: DbUser['budgetPlan'],
): Difference[] => {
  if (!raw && !db) return [];
  if (!raw) {
    return [{ kind: 'extra', collection: 'budget_plan', message: 'план есть в Postgres, но не в Firestore' }];
  }
  if (!db) {
    return [{ kind: 'missing', collection: 'budget_plan', message: 'план есть в Firestore, но не в Postgres' }];
  }

  const diffs: Difference[] = [];
  if (!deepEqual(raw.items, db.items)) {
    diffs.push({
      kind: 'changed',
      collection: 'budget_plan',
      field: 'items',
      message: 'состав плана различается',
    });
  }

  const expected = iso(raw.updatedAt);
  if (expected !== null && expected !== db.updatedAt.getTime()) {
    diffs.push({
      kind: 'changed',
      collection: 'budget_plan',
      field: 'updatedAt',
      message: `Firestore: ${new Date(expected).toISOString()}, Postgres: ${db.updatedAt.toISOString()}`,
    });
  }

  return diffs;
};

/**
 * Сверка одного пользователя: Firestore против Postgres.
 * Ловит не только расхождение значений, но и поля, которые импорт молча
 * не сохраняет, — это и есть главный риск перед переключением.
 */
export const compareUser = (
  raw: FirestoreUser,
  db: DbUser,
  options: CompareOptions = {},
): Difference[] => {
  const now = options.now ?? new Date();
  const diffs: Difference[] = [];

  diffs.push(...compareProfile(raw.profile, db.profile, options.uid));
  if (raw.profile) {
    diffs.push(...unknownFields('profiles', { id: options.uid ?? '', data: raw.profile }, PROFILE_KNOWN));
  }

  for (const [collection, docs, rows] of [
    ['assets', raw.assets, db.assets],
    ['liabilities', raw.liabilities, db.liabilities],
    ['income', raw.income, db.income],
  ] as const) {
    const expected = docs
      .map((doc) => toItemRow({ ...doc.data, id: doc.id }))
      .filter((row): row is ItemRow => row !== null);

    diffs.push(...compareById(collection, expected, rows, ['name', 'amount', 'monthly']));
    for (const doc of docs) {
      diffs.push(...unknownFields(collection, doc, ITEM_KNOWN), ...structuralDiffs(collection, doc, options.uid));
    }
  }

  const expectedArchive = raw.incomeArchive
    .map((doc) => toArchiveRow({ ...doc.data, id: doc.id }, now))
    .filter((row): row is ArchiveRow => row !== null);

  diffs.push(...compareById('income_archive', expectedArchive, db.incomeArchive, ['name', 'year', 'months']));
  for (const doc of raw.incomeArchive) {
    diffs.push(
      ...unknownFields('income_archive', doc, ARCHIVE_KNOWN),
      ...structuralDiffs('income_archive', doc, options.uid),
    );
  }

  diffs.push(...compareBudgetPlan(raw.budgetPlan, db.budgetPlan));
  if (raw.budgetPlan) {
    diffs.push(
      ...unknownFields(
        'budget_plan',
        { id: 'budget_plan', data: raw.budgetPlan as unknown as Record<string, unknown> },
        PLAN_KNOWN,
      ),
    );
  }

  return diffs;
};
