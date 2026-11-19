import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { FirestoreUser, RawDoc } from '../db/compare.js';

export type { FirestoreUser, RawDoc };

export const openFirestore = (projectId?: string): Firestore => {
  const app = initializeApp({ credential: applicationDefault(), projectId });
  return getFirestore(app);
};

const readDocs = async (fsdb: Firestore, path: string): Promise<RawDoc[]> => {
  const snapshot = await fsdb.collection(path).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }));
};

export const readBudgetPlan = async (
  fsdb: Firestore,
  uid: string,
): Promise<FirestoreUser['budgetPlan']> => {
  const paths = [`users/${uid}/budget_plan/budget_plan`, `budget_plan/users/${uid}/budget_plan`];

  for (const path of paths) {
    const snapshot = await fsdb.doc(path).get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() as { items?: unknown[]; updatedAt?: string } | undefined;
    return { items: Array.isArray(data?.items) ? data.items : [], updatedAt: data?.updatedAt ?? '' };
  }
  return null;
};

/** Читает пользователя из Firestore как есть — без преобразований, пригодно и для импорта, и для сверки. */
export const readFirestoreUser = async (fsdb: Firestore, uid: string): Promise<FirestoreUser> => {
  const [profileSnap, assets, liabilities, income, incomeArchive] = await Promise.all([
    fsdb.doc(`users/${uid}`).get(),
    readDocs(fsdb, `users/${uid}/assets`),
    readDocs(fsdb, `users/${uid}/liabilities`),
    readDocs(fsdb, `users/${uid}/income`),
    readDocs(fsdb, `users/${uid}/income_archive`),
  ]);

  return {
    profile: profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : null,
    assets,
    liabilities,
    income,
    incomeArchive,
    budgetPlan: await readBudgetPlan(fsdb, uid),
  };
};

export const listUserIds = async (fsdb: Firestore): Promise<string[]> => {
  const snapshot = await fsdb.collection('users').get();
  return snapshot.docs.map((doc) => doc.id);
};
