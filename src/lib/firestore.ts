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
} from 'firebase/firestore';

const RESET_FLAG_KEY = 'denegnyj_put_reset_pending';

export const isResetPending = (): boolean => {
  try {
    const v = localStorage.getItem(RESET_FLAG_KEY);
    return v !== null && v !== '';
  } catch {
    return false;
  }
};

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
  users: 'users',
};

export type UserStat = {
  uid: string;
  email: string;
  createdAt: string;
  lastActive: string;
};

/**
 * Создаёт или обновляет профиль пользователя в коллекции users.
 * createdAt фиксируется только при первом создании, lastActive обновляется при каждом входе.
 */
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
  } catch {
    // Firestore недоступен — игнорируем
  }
};

/**
 * Возвращает профили всех пользователей (для админ-статистики).
 */
export const getAllUsers = async (): Promise<UserStat[]> => {
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
  } catch {
    return [];
  }
};

export type FirestoreCollection = string;

export const ALL_COLLECTIONS: FirestoreCollection[] = [
  COLLECTIONS.assets,
  COLLECTIONS.liabilities,
  COLLECTIONS.income,
  COLLECTIONS.incomeArchive,
];

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

const nowIso = (): string => new Date().toISOString();

const stampItems = <T extends { id: string }>(items: T[]): T[] => {
  const now = nowIso();
  return items.map((item) => ({ ...item, updatedAt: now } as T));
};

const saveToLocalStorage = <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string
): void => {
  try {
    localStorage.setItem(storageKey(collectionName, userId), JSON.stringify(stampItems(items)));
  } catch {
    // ignore quota errors
  }
};

export const loadLocalCollection = <T extends { id: string }>(
  collectionName: string,
  userId?: string
): T[] => loadFromLocalStorage<T>(collectionName, userId);

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string
) => {
  const stamped = stampItems(items);
  // Сохраняем в локальное хранилище всегда (в т.ч. без авторизации), чтобы данные не пропадали при перезагрузке
  saveToLocalStorage(collectionName, stamped, userId);
  if (!userId) return;
  if (!firestoreDb) return;
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    // Сохраняем/обновляем существующие документы
    const batch = stamped.map((item) =>
      setDoc(doc(colRef, item.id), { ...item, userId } as Record<string, unknown>)
    );
    await Promise.all(batch);
    // Удаляем из Firestore документы, которых больше нет в локальном массиве,
    // иначе при следующей загрузке они восстановятся (строка «возвращается назад»)
    const currentIds = new Set(stamped.map((item) => item.id));
    const snapshot = await getDocs(query(colRef, orderBy('id')));
    const toDelete = snapshot.docs
      .filter((docSnap) => !currentIds.has(docSnap.id))
      .map((docSnap) => deleteDoc(docSnap.ref));
    if (toDelete.length > 0) {
      await Promise.all(toDelete);
    }
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
  // Сначала читаем локальное хранилище (работает с userId или без, для неавторизованных пользователей)
  const localData = loadFromLocalStorage<T>(collectionName, userId);
  if (localData.length > 0) {
    return localData;
  }

  // Без авторизации и без локальных данных — данные недоступны
  if (!userId) {
    return [];
  }

  if (!firestoreDb) {
    return [];
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
    }
    return data;
  } catch (err) {
    // Firestore недоступен (например, 400 Bad Request) — возвращаем локальные данные,
    // чтобы не показывать устаревшие данные из IndexedDB кэша
    const fallback = loadFromLocalStorage<T>(collectionName, userId);
    if (fallback.length > 0) {
      return fallback;
    }
    return [];
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
    // Чистим ключи, оставшиеся от предыдущих пользователей (после выхода из аккаунта)
    const prefix = `denegnyj_put_`;
    const suffix = `_${collectionName}`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if ((key.startsWith(prefix) && key.endsWith(suffix)) || key === `${prefix}${collectionName}`) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
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
      await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
      const after = await getDocs(colRef);
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

/**
 * Синхронизирует неотправленные изменения из локального кэша (localStorage)
 * в Firestore при появлении интернета. Вызывается из основного приложения
 * на событии online.
 */
export const syncPendingToFirestore = async (): Promise<void> => {
  if (!firestoreDb) return;
  const prefix = `denegnyj_put_`;
  const seen = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    // denegnyj_put_<userId>_<collection>
    const matched = ALL_COLLECTIONS.find((c) => rest.endsWith(`_${c}`));
    if (!matched) continue;
    const userId = rest.slice(0, rest.length - matched.length - 1);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    for (const collectionName of ALL_COLLECTIONS) {
      try {
        const items = loadFromLocalStorage<{ id: string }>(collectionName, userId);
        if (items.length === 0) continue;
        await saveToFirestore(collectionName, items, userId);
      } catch {
        // игнорируем ошибки отдельных коллекций
      }
    }
  }
};
