import { firestoreDb, firebaseError } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

const RESET_FLAG_KEY = 'denegnyj_put_reset_pending';

export const isResetPending = (): boolean => false;

export const getResetPendingUserId = (): string | undefined => {
  try {
    const v = localStorage.getItem(RESET_FLAG_KEY);
    if (v === null) return undefined;
    return v === '' ? undefined : v;
  } catch {
    return undefined;
  }
};

export const clearResetPending = () => {
  try {
    localStorage.removeItem(RESET_FLAG_KEY);
  } catch {
    // ignore
  }
};
export const COLLECTIONS = {
  assets: 'assets',
  liabilities: 'liabilities',
  income: 'income',
  incomeArchive: 'income_archive',
  budgetPlan: 'budget_plan',
};

export type FirestoreCollection = string;

const storageKey = (collectionName: string, userId?: string) =>
  userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;

const colPath = (collectionName: string, userId?: string) =>
  userId ? `users/${userId}/${collectionName}` : collectionName;

const loadFromLocalStorage = <T extends { id: string }>(
  collectionName: string,
  userId?: string
): T[] => {
  try {
    const raw = localStorage.getItem(storageKey(collectionName, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const saveToLocalStorage = <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string
): void => {
  try {
    localStorage.setItem(storageKey(collectionName, userId), JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string
) => {
  if (!userId) return;
  saveToLocalStorage(collectionName, items, userId);
  if (!firestoreDb) return;
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    const batch = items.map((item) =>
      setDoc(doc(colRef, item.id), { ...item, userId } as Record<string, unknown>)
    );
    await Promise.all(batch);
    // После успешного сохранения новых данных — снимаем флаг сброса
    clearResetPending();
  } catch {
    // Firestore недоступен, localStorage уже сохранён
  }
};

export const loadFromFirestore = async <T extends { id: string } = { id: string }>(
  collectionName: string,
  userId?: string
): Promise<T[]> => {
  // Без авторизации — данные недоступны, возвращаем пустой массив
  if (!userId) {
    return [];
  }
  if (!firestoreDb) {
    return loadFromLocalStorage<T>(collectionName, userId);
  }
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    const q = query(colRef, orderBy('id'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(
      (docSnap) => docSnap.data() as unknown as T
    );
    if (data.length > 0) {
      saveToLocalStorage(collectionName, data, userId);
      return data;
    }
    // Firestore пуст — проверяем локальное хранилище (мигрированные данные)
    const localData = loadFromLocalStorage<T>(collectionName, userId);
    if (localData.length > 0) {
      return localData;
    }
    return [];
  } catch {
    return loadFromLocalStorage<T>(collectionName, userId);
  }
};

/**
 * Переносит старые локальные данные (без userId) в пользовательское хранилище
 * и загружает в Firestore под данным пользователем.
 */
export const migrateCollectionToUser = async (
  collectionName: string,
  userId: string
): Promise<void> => {
  const oldData = loadFromLocalStorage<{ id: string }>(
    collectionName,
    undefined
  );
  if (!oldData || oldData.length === 0) return;

  // Сохраняем в пользовательский localStorage
  saveToLocalStorage(collectionName, oldData, userId);

  // Загружаем в Firestore
  if (!firestoreDb) return;
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    const batch = oldData.map((item) =>
      setDoc(doc(colRef, item.id), { ...item, userId } as Record<string, unknown>)
    );
    await Promise.all(batch);
  } catch {
    // Firestore недоступен, localStorage уже сохранён
  }
};

export const deleteFromFirestore = async (
  collectionName: string,
  id: string,
  userId?: string
) => {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(storageKey(collectionName, userId));
    if (raw) {
      const items = JSON.parse(raw) as { id: string }[];
      const filtered = items.filter((it) => it.id !== id);
      localStorage.setItem(storageKey(collectionName, userId), JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
  if (!firestoreDb || !userId) return;
  try {
    await deleteDoc(doc(firestoreDb, colPath(collectionName, userId), id));
  } catch {
    // ignore
  }
};

export const clearCollectionData = (
  collectionName: string,
  userId?: string
): void => {
  // Чистим локальное хранилище синхронно
  try {
    localStorage.removeItem(storageKey(collectionName, userId));
    localStorage.removeItem(storageKey(collectionName, undefined));
  } catch {
    // ignore
  }
};

export const cleanupResetPendingFirestore = async (userId: string): Promise<boolean> => {
  if (!firestoreDb || !userId) {
    return true;
  }
  let hadError = false;
  const collections = [COLLECTIONS.assets, COLLECTIONS.liabilities, COLLECTIONS.income, COLLECTIONS.incomeArchive];
  for (const c of collections) {
    try {
      const colRef = collection(firestoreDb!, colPath(c, userId));
      const snapshot = await getDocs(colRef);
      console.log('[cleanup] ' + c + ': found ' + snapshot.docs.length + ' docs');
      await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
      const after = await getDocs(colRef);
      console.log('[cleanup] ' + c + ': after delete ' + after.docs.length + ' docs remain');
      if (after.docs.length > 0) {
        hadError = true;
        console.error('[cleanup] ' + c + ': docs still remain!');
      }
    } catch (e) {
      hadError = true;
      console.error('cleanup failed for', c, e);
    }
  }
  // budget plan
  try {
    await deleteDoc(doc(firestoreDb!, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan'));
  } catch (e) {
    console.error('budget cleanup failed', e);
  }
  return !hadError;
};

export { firestoreDb, firebaseError };
