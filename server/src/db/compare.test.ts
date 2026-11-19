import { describe, expect, it } from 'vitest';
import { compareUser, type DbUser, type FirestoreUser } from './compare.js';

const createdAt = new Date('2026-11-08T06:14:59.973Z');
const lastActive = new Date('2026-11-19T03:13:51.249Z');

const empty = (): FirestoreUser => ({
  profile: null,
  assets: [],
  liabilities: [],
  income: [],
  incomeArchive: [],
  budgetPlan: null,
});

const emptyDb = (): DbUser => ({
  profile: null,
  assets: [],
  liabilities: [],
  income: [],
  incomeArchive: [],
  budgetPlan: null,
});

const doc = (id: string, data: Record<string, unknown>) => ({ id, data });

describe('compareUser', () => {
  it('не находит различий в совпадающих данных', () => {
    const raw: FirestoreUser = {
      ...empty(),
      profile: { email: 'a@example.com', createdAt: createdAt.toISOString(), lastActive: lastActive.toISOString(), avatar: null },
      assets: [doc('a1', { name: 'Вклад', amount: 100, monthly: 10 })],
      budgetPlan: { items: [{ id: 'x', amount: 5 }], updatedAt: lastActive.toISOString() },
    };
    const db: DbUser = {
      ...emptyDb(),
      profile: { email: 'a@example.com', createdAt, lastActive, avatar: null, acceptedTermsVersion: null, acceptedPrivacyVersion: null, consentUpdatedAt: null },
      assets: [{ id: 'a1', name: 'Вклад', amount: 100, monthly: 10 }],
      budgetPlan: { items: [{ id: 'x', amount: 5 }], updatedAt: lastActive },
    };

    expect(compareUser(raw, db)).toEqual([]);
  });

  it('находит запись, потерянную при импорте', () => {
    const raw: FirestoreUser = { ...empty(), income: [doc('i1', { name: 'Зарплата', amount: 1000, monthly: 0 })] };

    expect(compareUser(raw, emptyDb())).toContainEqual({
      kind: 'missing',
      collection: 'income',
      id: 'i1',
      message: 'запись есть в Firestore, но отсутствует в Postgres',
    });
  });

  it('находит лишнюю запись в Postgres', () => {
    const db: DbUser = { ...emptyDb(), liabilities: [{ id: 'l1', name: 'Кредит', amount: 1, monthly: 1 }] };

    expect(compareUser(empty(), db)).toContainEqual({
      kind: 'extra',
      collection: 'liabilities',
      id: 'l1',
      message: 'запись есть в Postgres, но отсутствует в Firestore',
    });
  });

  it('находит расхождение суммы', () => {
    const raw: FirestoreUser = { ...empty(), assets: [doc('a1', { name: 'Вклад', amount: 100, monthly: 0 })] };
    const db: DbUser = { ...emptyDb(), assets: [{ id: 'a1', name: 'Вклад', amount: 99, monthly: 0 }] };

    const diffs = compareUser(raw, db);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ kind: 'changed', collection: 'assets', id: 'a1', field: 'amount' });
  });

  it('сообщает о полях, которых нет в Postgres', () => {
    const raw: FirestoreUser = {
      ...empty(),
      income: [doc('i1', { name: 'Проект', amount: 500, monthly: 0, importBatchId: 'b-1' })],
    };

    const diffs = compareUser(raw, { ...emptyDb(), income: [{ id: 'i1', name: 'Проект', amount: 500, monthly: 0 }] });
    expect(diffs).toContainEqual(
      expect.objectContaining({ kind: 'unknown-field', collection: 'income', id: 'i1', field: 'importBatchId' }),
    );
  });

  it('понимает legacy-архив без months', () => {
    const raw: FirestoreUser = {
      ...empty(),
      incomeArchive: [doc('h1', { name: '2025', year: 2025, amount: 100, monthly: 200 })],
    };
    const db: DbUser = {
      ...emptyDb(),
      incomeArchive: [{ id: 'h1', name: '2025', year: 2025, months: [100, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }],
    };

    expect(compareUser(raw, db)).toEqual([]);
  });

  it('находит расхождение в месяцах архива', () => {
    const raw: FirestoreUser = { ...empty(), incomeArchive: [doc('h1', { name: '2025', year: 2025, months: Array(12).fill(1) })] };
    const db: DbUser = {
      ...emptyDb(),
      incomeArchive: [{ id: 'h1', name: '2025', year: 2025, months: Array(12).fill(2) }],
    };

    expect(compareUser(raw, db)).toContainEqual(
      expect.objectContaining({ kind: 'changed', collection: 'income_archive', field: 'months' }),
    );
  });

  it('сравнивает план бюджета без учёта порядка ключей', () => {
    const items = [{ id: 'b1', title: 'Аренда', amount: 30000, paid: false }];
    const raw: FirestoreUser = { ...empty(), budgetPlan: { items, updatedAt: lastActive.toISOString() } };
    const db: DbUser = {
      ...emptyDb(),
      budgetPlan: { items: [{ amount: 30000, paid: false, title: 'Аренда', id: 'b1' }], updatedAt: lastActive },
    };

    expect(compareUser(raw, db)).toEqual([]);
  });

  it('находит расхождение дат профиля', () => {
    const raw: FirestoreUser = {
      ...empty(),
      profile: { email: 'a@example.com', createdAt: createdAt.toISOString(), lastActive: lastActive.toISOString() },
    };
    const db: DbUser = {
      ...emptyDb(),
      profile: { email: 'a@example.com', createdAt, lastActive: new Date('2026-11-19T04:00:00.000Z'), avatar: null, acceptedTermsVersion: null, acceptedPrivacyVersion: null, consentUpdatedAt: null },
    };

    expect(compareUser(raw, db)).toContainEqual(
      expect.objectContaining({ kind: 'changed', collection: 'profiles', field: 'lastActive' }),
    );
  });

  it('переносит записи о согласии', () => {
    const consent = '2026-11-10T08:26:46.056Z';
    const raw: FirestoreUser = {
      ...empty(),
      profile: {
        email: 'a@example.com',
        acceptedTermsVersion: '2026-11-10',
        acceptedPrivacyVersion: '2026-11-10',
        consentUpdatedAt: consent,
      },
    };
    const db: DbUser = {
      ...emptyDb(),
      profile: {
        email: 'a@example.com',
        createdAt,
        lastActive,
        avatar: null,
        acceptedTermsVersion: '2026-11-10',
        acceptedPrivacyVersion: '2026-11-10',
        consentUpdatedAt: new Date(consent),
      },
    };

    expect(compareUser(raw, db)).toEqual([]);
  });

  it('находит расхождение версии согласия', () => {
    const raw: FirestoreUser = { ...empty(), profile: { acceptedTermsVersion: '2026-11-10' } };
    const db: DbUser = {
      ...emptyDb(),
      profile: {
        email: '',
        createdAt,
        lastActive,
        avatar: null,
        acceptedTermsVersion: '2026-01-01',
        acceptedPrivacyVersion: null,
        consentUpdatedAt: null,
      },
    };

    expect(compareUser(raw, db)).toContainEqual(
      expect.objectContaining({ kind: 'changed', collection: 'profiles', field: 'acceptedTermsVersion' }),
    );
  });

  it('не считает служебные поля документа потерянными', () => {
    const raw: FirestoreUser = {
      ...empty(),
      income: [doc('i1', { id: 'i1', userId: 'u1', updatedAt: '2026-11-19T03:00:00.000Z', name: 'X', amount: 1, monthly: 0 })],
    };
    const db: DbUser = { ...emptyDb(), income: [{ id: 'i1', name: 'X', amount: 1, monthly: 0 }] };

    expect(compareUser(raw, db, { uid: 'u1' })).toEqual([]);
  });

  it('находит чужой userId в документе', () => {
    const raw: FirestoreUser = {
      ...empty(),
      income: [doc('i1', { userId: 'other', name: 'X', amount: 1, monthly: 0 })],
    };
    const db: DbUser = { ...emptyDb(), income: [{ id: 'i1', name: 'X', amount: 1, monthly: 0 }] };

    expect(compareUser(raw, db, { uid: 'u1' })).toContainEqual(
      expect.objectContaining({ kind: 'changed', collection: 'income', field: 'userId' }),
    );
  });
});
