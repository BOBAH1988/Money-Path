import type { AdminStats } from './apiClient';
import * as api from './apiBackend';
import { BACKEND_CONFIG, isApiBackend } from './backend';
import * as firestore from './firestoreBackend';
import {
  ALL_COLLECTIONS,
  COLLECTIONS,
  type FirestoreCollection,
} from './dataStore';

export {
  ALL_COLLECTIONS,
  COLLECTIONS,
  clearCollectionData,
  clearLocalData,
  clearPendingBudgetPlan,
  clearUserLocalData,
  colPath,
  enqueueBudgetPlan,
  enqueueCollectionClear,
  enqueueCollectionDelete,
  enqueueCollectionUpsert,
  firebaseError,
  getFirestoreDb,
  getPendingBudgetPlan,
  getPendingCollectionOperations,
  loadLocalBudgetPlan,
  loadLocalCollection,
  removePendingCollectionOperation,
  resetFirestoreDb,
  saveLocalBudgetPlan,
  saveLocalCollection,
  storageKeyFor,
  withTimeout,
} from './firestoreBackend';
export type { FirestoreCollection, SnapshotOptions } from './firestoreBackend';

/**
 * Фасад слоя данных. Пока флаг не переключён — работает прежняя Firestore-реализация,
 * при VITE_DATA_BACKEND=api запросы уходят на собственный сервер. Сигнатуры одинаковы
 * для обоих транспортов, чтобы UI и useData не зависели от выбора.
 */

const isDualWrite = (): boolean => !isApiBackend() && BACKEND_CONFIG.dualWrite;

/** Копия записи в API в режиме dual-write: сбой API не должен ломать основной путь. */
const mirror = async (label: string, run: () => Promise<void>): Promise<void> => {
  try {
    await run();
  } catch (err) {
    console.warn(`[dual-write] ${label}: запись в API не удалась`, err);
  }
};

const shadowCompare = async <T extends { id: string }>(
  collectionName: string,
  userId: string | undefined,
  items: T[],
): Promise<void> => {
  if (!BACKEND_CONFIG.shadow || !userId) return;

  try {
    const remote = await api.fetchCollectionSnapshot<T>(collectionName, userId);
    const localById = new Map(items.map((item) => [item.id, item]));
    const remoteIds = new Set(remote.map((item) => item.id));

    const missing = items.filter((item) => !remoteIds.has(item.id)).map((item) => item.id);
    const extra = remote.filter((item) => !localById.has(item.id)).map((item) => item.id);
    const changed = remote
      .filter((item) => {
        const local = localById.get(item.id);
        return local !== undefined && JSON.stringify(local) !== JSON.stringify(item);
      })
      .map((item) => item.id);

    if (missing.length || extra.length || changed.length) {
      console.warn(`[shadow] ${collectionName}: расхождение с API`, {
        нетВApi: missing.slice(0, 5),
        нетВFirestore: extra.slice(0, 5),
        изменились: changed.slice(0, 5),
        всего: { нетВApi: missing.length, нетВFirestore: extra.length, изменились: changed.length },
      });
    }
  } catch (err) {
    console.warn(`[shadow] ${collectionName}: чтение из API не удалось`, err);
  }
};

export const loadFromFirestore = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
  onFresh?: (items: T[]) => void,
  onServerError?: (error: Error) => void,
): Promise<T[]> => {
  if (isApiBackend()) {
    return api.loadFromFirestore<T>(collectionName, userId, onFresh, onServerError);
  }

  const items = await firestore.loadFromFirestore<T>(collectionName, userId, onFresh, onServerError);
  void shadowCompare(collectionName, userId, items);
  return items;
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
): Promise<void> => {
  if (isApiBackend()) {
    await api.saveToFirestore(collectionName, items, userId);
    return;
  }

  await firestore.saveToFirestore(collectionName, items, userId);
  if (isDualWrite()) {
    await mirror(collectionName, () => api.dualWriteItems(collectionName, items, userId));
  }
};

export const clearFirestoreCollection = async (
  collectionName: FirestoreCollection,
  userId?: string,
): Promise<void> => {
  if (isApiBackend()) {
    await api.clearFirestoreCollection(collectionName, userId);
    return;
  }

  await firestore.clearFirestoreCollection(collectionName, userId);
  if (isDualWrite()) {
    await mirror(`clear/${collectionName}`, () => api.dualWriteClear(collectionName, userId));
  }
};

export const clearAccountData = async (
  userId?: string,
): Promise<{ synced: boolean; error?: string }> => {
  if (isApiBackend()) {
    return api.clearAccountData(userId);
  }

  const result = await firestore.clearAccountData(userId);
  if (isDualWrite() && userId) {
    for (const name of ALL_COLLECTIONS) {
      if (name === COLLECTIONS.budgetPlan) continue;
      await mirror(`clearAccount/${name}`, () => api.dualWriteClear(name, userId));
    }
    await mirror('clearAccount/budget_plan', () =>
      api.dualWriteBudgetPlan([], new Date().toISOString(), userId),
    );
  }
  return result;
};

export const loadBudgetPlan = async (
  userId?: string,
  onFresh?: (data: { items: unknown[]; updatedAt: string }) => void,
  onServerError?: (error: Error) => void,
): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (isApiBackend()) {
    return api.loadBudgetPlan(userId, onFresh, onServerError);
  }
  return firestore.loadBudgetPlan(userId, onFresh, onServerError);
};

export const saveBudgetPlan = async (
  userId?: string,
  items: unknown[] = [],
  updatedAt = new Date().toISOString(),
): Promise<void> => {
  if (isApiBackend()) {
    await api.saveBudgetPlan(userId, items, updatedAt);
    return;
  }

  await firestore.saveBudgetPlan(userId, items, updatedAt);
  if (isDualWrite()) {
    await mirror('budget_plan', () => api.dualWriteBudgetPlan(items, updatedAt, userId));
  }
};

export const syncPendingToFirestore = async (userId?: string): Promise<void> => {
  if (!userId) return;

  if (isApiBackend()) {
    await api.syncPendingToFirestore(userId);
    return;
  }

  if (isDualWrite()) {
    // Копию очереди отправляем до того, как Firestore-синхронизация её снимет.
    await mirror('sync/queue', () => api.pushQueue(userId, { keep: true }));
  }
  await firestore.syncPendingToFirestore(userId);
};

export const deleteAccountData = async (userId: string): Promise<void> => {
  if (isApiBackend()) {
    await api.deleteAccountData(userId);
    return;
  }
  await firestore.deleteAccountData(userId);
};

export const trackUser = async (uid: string, email: string): Promise<void> => {
  if (isApiBackend()) {
    await api.trackUser(uid, email);
    return;
  }
  await firestore.trackUser(uid, email);
};

export const saveUserAvatar = async (userId: string, dataUrl: string | null): Promise<void> => {
  if (isApiBackend()) {
    await api.saveUserAvatar(userId, dataUrl);
    return;
  }
  await firestore.saveUserAvatar(userId, dataUrl);
};

export const loadUserAvatar = async (userId: string): Promise<string | null> => {
  if (isApiBackend()) {
    return api.loadUserAvatar(userId);
  }
  return firestore.loadUserAvatar(userId);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const statsFromUsers = (users: { createdAt: string; lastActive: string }[], now = Date.now()): AdminStats => {
  const within = (iso: string, days: number): boolean => {
    if (!iso) return false;
    const time = new Date(iso).getTime();
    return Number.isFinite(time) && now - time <= days * DAY_MS;
  };

  return {
    total: users.length,
    active30: users.filter((user) => within(user.lastActive, 30)).length,
    new30: users.filter((user) => within(user.createdAt, 30)).length,
    new7: users.filter((user) => within(user.createdAt, 7)).length,
  };
};

/**
 * Агрегаты для админской аналитики. На API их считает сервер — клиент не получает
 * чужой список пользователей; на Firestore приходится считать по коллекции `users`.
 */
export const loadUserStats = async (currentUid?: string): Promise<AdminStats> => {
  if (isApiBackend()) {
    return api.loadUserStats();
  }
  return statsFromUsers(await firestore.getAllUsers(currentUid));
};
