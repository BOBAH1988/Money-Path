import {
  createApiClient,
  type ApiClient,
  type ApiCollection,
  type SyncOperation,
} from './apiClient';
import { BACKEND_CONFIG } from './backend';
import {
  ALL_COLLECTIONS,
  COLLECTIONS,
  clearPendingBudgetPlan,
  clearUserLocalData,
  enqueueBudgetPlan,
  enqueueCollectionClear,
  enqueueCollectionUpsert,
  getPendingBudgetPlan,
  getPendingCollectionOperations,
  loadLocalCollection,
  removePendingCollectionOperation,
  saveLocalBudgetPlan,
  saveLocalCollection,
  type FirestoreCollection,
  type PendingCollectionOperation,
} from './dataStore';
import { getIdToken } from './firebase';

const MAX_BATCH = 200;
const CLIENT_ID_KEY = 'denegnyj_put_client_id';

let client: ApiClient | null = null;

const getClient = (): ApiClient => {
  client ??= createApiClient({
    baseUrl: BACKEND_CONFIG.apiUrl,
    getToken: getIdToken,
  });
  return client;
};

/** Сбрасывает созданный клиент — нужен тестам и смене конфигурации. */
export const resetApiClient = (): void => {
  client = null;
};

const clientId = (): string => {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return 'unknown';
  }
};

const toOperation = (name: FirestoreCollection, operation: PendingCollectionOperation): SyncOperation => {
  if (operation.type === 'upsert') {
    return {
      op: 'upsert',
      operationId: operation.id,
      collection: name as ApiCollection,
      item: operation.item,
    };
  }
  if (operation.type === 'delete') {
    return {
      op: 'delete',
      operationId: operation.id,
      collection: name as ApiCollection,
      itemId: operation.itemId,
    };
  }
  return { op: 'clear', operationId: operation.id, collection: name as ApiCollection };
};

/**
 * Отправляет локальную очередь в API.
 * `keep: true` — дослать копию, не снимая операции с очереди (режим dual-write).
 */
export const pushQueue = async (userId: string, options: { keep?: boolean } = {}): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Нет подключения к интернету. Изменения сохранены на устройстве.');
  }

  const api = getClient();
  const id = clientId();

  for (const name of ALL_COLLECTIONS) {
    if (name === COLLECTIONS.budgetPlan) continue;
    const pending = getPendingCollectionOperations(name, userId);
    for (let offset = 0; offset < pending.length; offset += MAX_BATCH) {
      const chunk = pending.slice(offset, offset + MAX_BATCH);
      await api.sync(id, chunk.map((operation) => toOperation(name, operation)));
      if (!options.keep) {
        for (const operation of chunk) removePendingCollectionOperation(name, userId, operation.id);
      }
    }
  }

  const plan = getPendingBudgetPlan(userId);
  if (plan) {
    await api.sync(id, [
      { op: 'budget_plan', operationId: plan.id, items: plan.items, updatedAt: plan.updatedAt },
    ]);
    if (!options.keep) clearPendingBudgetPlan(userId, plan.id);
  }
};

export const syncPendingToFirestore = async (userId?: string): Promise<void> => {
  if (!userId) return;
  await pushQueue(userId);
};

export const loadFromFirestore = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
  onFresh?: (items: T[]) => void,
  onServerError?: (error: Error) => void,
): Promise<T[]> => {
  if (!userId) return [];
  try {
    const snapshot = await getClient().getCollection<T>(collectionName as ApiCollection);
    saveLocalCollection(collectionName, snapshot.items, userId);
    onFresh?.(snapshot.items);
    return snapshot.items;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Не удалось загрузить данные');
    onServerError?.(error);
    throw error;
  }
};

/** Чтение для теневого режима: без записи в локальный кэш. */
export const fetchCollectionSnapshot = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
): Promise<T[]> => {
  if (!userId) return [];
  const snapshot = await getClient().getCollection<T>(collectionName as ApiCollection);
  return snapshot.items;
};

/** Дублирование записи в API напрямую (best-effort, под флагом VITE_DUAL_WRITE). */
export const dualWriteItems = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
): Promise<void> => {
  if (!userId) return;
  const api = getClient();
  for (const item of items) await api.putItem(collectionName as ApiCollection, item);
};

/** Дублирование полной очистки коллекции в API. */
export const dualWriteClear = async (collectionName: string, userId?: string): Promise<void> => {
  if (!userId) return;
  await getClient().clearCollection(collectionName as ApiCollection);
};

/** Дублирование плана бюджета в API. */
export const dualWriteBudgetPlan = async (
  items: unknown[],
  updatedAt: string,
  userId?: string,
): Promise<void> => {
  if (!userId) return;
  await getClient().putBudgetPlan({ items, updatedAt });
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
): Promise<void> => {
  if (!userId) return;
  const existing = loadLocalCollection<T>(collectionName, userId);
  const merged = new Map(existing.map((item) => [item.id, item]));
  for (const item of items) {
    merged.set(item.id, item);
    enqueueCollectionUpsert(collectionName as FirestoreCollection, userId, item);
  }
  saveLocalCollection(collectionName, [...merged.values()], userId);
  await syncPendingToFirestore(userId);
};

export const clearFirestoreCollection = async (
  collectionName: FirestoreCollection,
  userId?: string,
): Promise<void> => {
  if (!userId) return;
  enqueueCollectionClear(collectionName, userId);
  saveLocalCollection(collectionName, [], userId);
  await syncPendingToFirestore(userId);
};

export const clearAccountData = async (
  userId?: string,
): Promise<{ synced: boolean; error?: string }> => {
  if (!userId) return { synced: true };

  for (const name of ALL_COLLECTIONS) {
    if (name === COLLECTIONS.budgetPlan) continue;
    enqueueCollectionClear(name, userId);
    saveLocalCollection(name, [], userId);
  }
  const updatedAt = new Date().toISOString();
  enqueueBudgetPlan(userId, [], updatedAt);
  saveLocalBudgetPlan([], userId, updatedAt);

  try {
    await syncPendingToFirestore(userId);
    return { synced: true };
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : 'Ожидание подключения',
    };
  }
};

export const loadBudgetPlan = async (
  userId?: string,
  onFresh?: (data: { items: unknown[]; updatedAt: string }) => void,
  onServerError?: (error: Error) => void,
): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId) return { items: [], updatedAt: '' };

  try {
    const plan = await getClient().getBudgetPlan();
    saveLocalBudgetPlan(plan.items, userId, plan.updatedAt);
    onFresh?.(plan);
    return plan;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Не удалось загрузить план бюджета');
    onServerError?.(error);
    throw error;
  }
};

export const saveBudgetPlan = async (
  userId?: string,
  items: unknown[] = [],
  updatedAt = new Date().toISOString(),
): Promise<void> => {
  if (!userId) return;
  enqueueBudgetPlan(userId, items, updatedAt);
  saveLocalBudgetPlan(items, userId, updatedAt);
  await syncPendingToFirestore(userId);
};

export const deleteAccountData = async (userId: string): Promise<void> => {
  if (!userId) throw new Error('Не удалось определить аккаунт для удаления');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Для удаления аккаунта необходимо подключение к интернету');
  }

  await getClient().deleteAccount();
  clearUserLocalData(userId);
};

export const trackUser = async (uid: string, email: string): Promise<void> => {
  try {
    await getClient().putProfile({ email });
  } catch (err) {
    console.error(`[api] trackUser uid=${uid} ошибка:`, err);
  }
};

export const saveUserAvatar = async (userId: string, dataUrl: string | null): Promise<void> => {
  await getClient().putProfile({ avatar: dataUrl });
  try {
    localStorage.setItem(`denegnyj_put_avatar_${userId}`, dataUrl ?? '');
  } catch {
    // кэш недоступен — аватар останется только в API
  }
};

export const loadUserAvatar = async (userId: string): Promise<string | null> => {
  try {
    const cached = localStorage.getItem(`denegnyj_put_avatar_${userId}`);
    if (cached !== null) return cached || null;
  } catch {
    // кэш недоступен
  }

  try {
    const profile = await getClient().getProfile();
    return profile.avatar;
  } catch (err) {
    console.error('[api] loadUserAvatar ошибка:', err);
    return null;
  }
};

export const getAllUsers = async (): Promise<never> => {
  throw new Error(
    'Список пользователей недоступен на собственном API: нужен админский эндпоинт (см. PLAN.md, этап 2).',
  );
};
