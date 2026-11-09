import { firestoreDb, firebaseError } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

export const COLLECTIONS = {
  assets: 'assets',
  liabilities: 'liabilities',
  income: 'income',
  incomeArchive: 'income_archive',
  budgetPlan: 'budget_plan',
  users: 'users',
} as const;

export type FirestoreCollection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const ALL_COLLECTIONS: FirestoreCollection[] = [
  COLLECTIONS.assets,
  COLLECTIONS.liabilities,
  COLLECTIONS.income,
  COLLECTIONS.incomeArchive,
  COLLECTIONS.budgetPlan,
];

export const idField = (id: string): string => id;

const storageKey = (collectionName: string, userId?: string) =>
  userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;

export const colPath = (collectionName: string, userId?: string) =>
  userId ? `users/${userId}/${collectionName}` : collectionName;

export const storageKeyFor = (collectionName: string, userId?: string) => storageKey(collectionName, userId);

export const isResetPending = (): boolean => {
  try {
    const v = localStorage.getItem('denegnyj_put_reset_pending');
    return v !== null && v !== '';
  } catch {
    return false;
  }
};

export const getResetPendingUserId = (): string | undefined => {
  try {
    const v = localStorage.getItem('denegnyj_put_reset_pending');
    if (v === null) return undefined;
    return v === '' ? undefined : v;
  } catch {
    return undefined;
  }
};

export const clearResetPending = () => {
  try {
    localStorage.removeItem('denegnyj_put_reset_pending');
  } catch {
    // ignore
  }
};

export const clearCollectionData = (collectionName: string, userId?: string): void => {
  try {
    localStorage.removeItem(storageKey(collectionName, userId));
    localStorage.removeItem(storageKey(collectionName, undefined));
  } catch {
    // ignore
  }
};

export const trackUser = async (uid: string, email: string): Promise<void> => {
  if (!firestoreDb) return;
  try {
    const userRef = doc(firestoreDb, 'users', uid);
    const snap = await getDoc(userRef);
    const now = new Date().toISOString();
    if (!snap.exists()) {
      await setDoc(userRef, { uid, email, createdAt: now, lastActive: now });
    } else {
      await setDoc(userRef, { ...snap.data(), email, lastActive: now }, { merge: true });
    }
  } catch (err) {
    console.error(`[firestore] trackUser uid=${uid} ошибка:`, err);
  }
};

export const getAllUsers = async (): Promise<{ uid: string; email: string; createdAt: string; lastActive: string }[]> => {
  if (!firestoreDb) return [];
  try {
    const snapshot = await getDocs(collection(firestoreDb, 'users'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        uid: docSnap.id,
        email: String(data.email ?? ''),
        createdAt: String(data.createdAt ?? ''),
        lastActive: String(data.lastActive ?? ''),
      };
    });
  } catch (err) {
    console.error('[firestore] getAllUsers ошибка:', err);
    return [];
  }
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
) => {
  const stamped = items.map((item) => ({ ...item, updatedAt: new Date().toISOString() } as T));
  if (!userId) return;
  if (!firestoreDb) return;
  const colRef = collection(firestoreDb, colPath(collectionName, userId));
  const batch = stamped.map((item) =>
    setDoc(doc(colRef, item.id), { ...item, userId } as DocumentData),
  );
  try {
    await Promise.all(batch);
  } catch (err) {
    console.error(`[firestore] saveToFirestore(${collectionName}) ошибка:`, err);
    throw err;
  }
};

export const deleteFromFirestore = async (collectionName: string, id: string, userId?: string) => {
  if (!userId || !firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, colPath(collectionName, userId), id));
  } catch (err) {
    console.error(`[firestore] deleteFromFirestore(${collectionName}, id=${id}) ошибка:`, err);
  }
};

export const loadFromFirestore = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
): Promise<T[]> => {
  if (!userId || !firestoreDb) return [];
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as T & Record<string, unknown>;
      return {
        id: docSnap.id,
        ...data,
      } as T;
    });
  } catch (err) {
    console.error(`[firestore] loadFromFirestore(${collectionName}) ошибка:`, err);
    return [];
  }
};

export const loadBudgetPlan = async (userId?: string): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId || !firestoreDb) {
    return { items: [], updatedAt: '' };
  }
  try {
    const docRef = doc(firestoreDb, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as { items?: unknown[]; updatedAt?: string };
      return { items: data.items ?? [], updatedAt: data.updatedAt ?? '' };
    }
  } catch (err) {
    console.error('[firestore] loadBudgetPlan ошибка:', err);
  }
  return { items: [], updatedAt: '' };
};

export const saveBudgetPlan = async (userId?: string, items: unknown[] = [], updatedAt = new Date().toISOString()) => {
  if (!userId || !firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan'), {
      items,
      updatedAt,
      userId,
    });
  } catch (err) {
    console.error('[firestore] saveBudgetPlan ошибка:', err);
    throw err;
  }
};

export const resetBudgetPlan = async (userId?: string): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId || !firestoreDb) {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  try {
    await setDoc(doc(firestoreDb, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan'), {
      items: [],
      updatedAt: new Date().toISOString(),
      userId,
    });
  } catch (err) {
    console.error('[firestore] resetBudgetPlan ошибка:', err);
    throw err;
  }
  return { items: [], updatedAt: new Date().toISOString() };
};

export const syncPendingToFirestore = async (): Promise<void> => {
  if (!firestoreDb) return;
  const prefix = `denegnyj_put_`;
  const seen = new Set<string>();
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const matched = ALL_COLLECTIONS.find((c) => rest.endsWith(`_${c}`));
    if (!matched) continue;
    const userId = rest.slice(0, rest.length - matched.length - 1);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    try {
      const items = JSON.parse(localStorage.getItem(key) ?? '[]') as { id: string }[];
      if (items.length === 0) continue;
      await saveToFirestore(matched, items, userId);
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`[firestore] syncPendingToFirestore(${matched}) ошибка:`, err);
    }
  }
};

export { firestoreDb, firebaseError };
