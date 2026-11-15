import { createId } from './id';

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

export const colPath = (collectionName: string, userId?: string) =>
  userId ? `users/${userId}/${collectionName}` : collectionName;

export const storageKeyFor = (collectionName: string, userId?: string) =>
  userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;

export type PendingCollectionOperation =
  | { id: string; type: 'upsert'; item: { id: string; [key: string]: unknown } }
  | { id: string; type: 'delete'; itemId: string }
  | { id: string; type: 'clear' };

export interface PendingBudgetPlan {
  id: string;
  items: unknown[];
  updatedAt: string;
}

const pendingCollectionKey = (name: string, userId: string) =>
  `denegnyj_put_pending_${userId}_${name}`;
const pendingBudgetKey = (userId: string) =>
  pendingCollectionKey(COLLECTIONS.budgetPlan, userId);

const isValidOperation = (entry: unknown): boolean => {
  if (!entry || typeof entry !== 'object') return false;
  const operation = entry as Partial<PendingCollectionOperation> & { id?: unknown };
  if (typeof operation.id !== 'string') return false;
  if (operation.type === 'upsert') {
    if (!operation.item || typeof operation.item.id !== 'string') return false;
    return true;
  }
  if (operation.type === 'delete') return typeof operation.itemId === 'string';
  return operation.type === 'clear';
};

/**
 * Битую очередь нельзя молча выбросить: в ней могут быть неотправленные
 * изменения. Сохраняем повреждённый снимок под отдельным ключом для диагностики.
 */
const quarantine = (key: string, raw: string) => {
  try {
    localStorage.setItem(`${key}_corrupt_${Date.now()}`, raw);
  } catch {
    // нет места под диагностику — продолжаем без неё
  }
};

/**
 * Читает очередь синхронизации. Повреждённое или недоступное хранилище не должно
 * ронять приложение: возвращаем пустую очередь, а повреждённый снимок сохраняем
 * отдельно, чтобы данные не пропали бесследно.
 */
const readPendingQueue = (key: string): PendingCollectionOperation[] => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.error('[dataStore] не удалось прочитать очередь синхронизации:', err);
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValidOperation)) {
      throw new Error('Формат очереди синхронизации повреждён');
    }
    return parsed as PendingCollectionOperation[];
  } catch (err) {
    console.error(`[dataStore] очередь ${key} повреждена и сброшена:`, err);
    quarantine(key, raw);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return [];
  }
};

/**
 * Сохраняет очередь. Возвращает false, когда запись не удалась (например,
 * хранилище переполнено), чтобы вызывающий код мог честно сообщить об этом.
 */
const writePendingQueue = (key: string, operations: PendingCollectionOperation[]): boolean => {
  try {
    if (operations.length) localStorage.setItem(key, JSON.stringify(operations));
    else localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.error(`[dataStore] не удалось сохранить очередь ${key}:`, err);
    return false;
  }
};

export const enqueueCollectionUpsert = (
  name: FirestoreCollection,
  userId: string,
  item: { id: string; [key: string]: unknown },
) => {
  const key = pendingCollectionKey(name, userId);
  const operations = readPendingQueue(key).filter(
    (operation) => operation.type === 'clear' ||
      (operation.type === 'upsert' ? operation.item.id : operation.itemId) !== item.id,
  );
  operations.push({ id: createId(), type: 'upsert', item });
  if (!writePendingQueue(key, operations)) {
    throw new Error('Не удалось сохранить очередь синхронизации на устройстве');
  }
};

export const enqueueCollectionDelete = (
  name: FirestoreCollection,
  userId: string,
  itemId: string,
) => {
  const key = pendingCollectionKey(name, userId);
  const operations = readPendingQueue(key).filter(
    (operation) => operation.type === 'clear' ||
      (operation.type === 'upsert' ? operation.item.id : operation.itemId) !== itemId,
  );
  operations.push({ id: createId(), type: 'delete', itemId });
  if (!writePendingQueue(key, operations)) {
    throw new Error('Не удалось сохранить очередь синхронизации на устройстве');
  }
};

export const enqueueCollectionClear = (name: FirestoreCollection, userId: string) => {
  const written = writePendingQueue(pendingCollectionKey(name, userId), [
    { id: createId(), type: 'clear' },
  ]);
  if (!written) {
    throw new Error('Не удалось сохранить очередь синхронизации на устройстве');
  }
};

export const getPendingCollectionOperations = (name: FirestoreCollection, userId: string) =>
  readPendingQueue(pendingCollectionKey(name, userId));

export const removePendingCollectionOperation = (
  name: FirestoreCollection,
  userId: string,
  operationId: string,
) => {
  const key = pendingCollectionKey(name, userId);
  writePendingQueue(key, readPendingQueue(key).filter((operation) => operation.id !== operationId));
};

export const saveLocalBudgetPlan = (
  items: unknown[],
  userId?: string,
  updatedAt = new Date().toISOString(),
) => {
  try {
    localStorage.setItem(storageKeyFor(COLLECTIONS.budgetPlan, userId), JSON.stringify({ items, updatedAt }));
  } catch (err) {
    throw new Error('Не удалось сохранить план бюджета на устройстве', { cause: err });
  }
};

export const loadLocalBudgetPlan = (userId?: string): { items: unknown[]; updatedAt: string } | null => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKeyFor(COLLECTIONS.budgetPlan, userId));
  } catch (err) {
    console.error('[dataStore] не удалось прочитать локальный план бюджета:', err);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, updatedAt: '' };
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) return null;
    const plan = parsed as { items: unknown[]; updatedAt?: unknown };
    return { items: plan.items, updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : '' };
  } catch (err) {
    console.error('[dataStore] локальный план бюджета повреждён:', err);
    return null;
  }
};

export const enqueueBudgetPlan = (userId: string, items: unknown[], updatedAt: string) => {
  try {
    localStorage.setItem(pendingBudgetKey(userId), JSON.stringify({
      id: createId(),
      items,
      updatedAt,
    } satisfies PendingBudgetPlan));
  } catch (err) {
    throw new Error('Не удалось сохранить план в очередь синхронизации', { cause: err });
  }
};

/**
 * Как и очередь коллекций, повреждённую очередь плана не считаем фатальной:
 * возвращаем null и сохраняем битый снимок для разбора.
 */
export const getPendingBudgetPlan = (userId: string): PendingBudgetPlan | null => {
  const key = pendingBudgetKey(userId);
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.error('[dataStore] не удалось прочитать очередь плана:', err);
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Формат очереди плана повреждён');
    const plan = parsed as Partial<PendingBudgetPlan>;
    if (typeof plan.id !== 'string' || !Array.isArray(plan.items)) {
      throw new Error('Формат очереди плана повреждён');
    }
    return { id: plan.id, items: plan.items, updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : '' };
  } catch (err) {
    console.error(`[dataStore] очередь плана ${key} повреждена и сброшена:`, err);
    quarantine(key, raw);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return null;
  }
};

export const clearPendingBudgetPlan = (userId: string, operationId: string) => {
  const key = pendingBudgetKey(userId);
  if (getPendingBudgetPlan(userId)?.id !== operationId) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    throw new Error('Не удалось очистить очередь синхронизации плана', { cause: err });
  }
};

export const loadLocalCollection = <T extends { id: string }>(collectionName: string, userId?: string): T[] => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKeyFor(collectionName, userId));
  } catch (err) {
    console.error(`[dataStore] не удалось прочитать коллекцию ${collectionName}:`, err);
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.error(`[dataStore] локальная коллекция ${collectionName} повреждена:`, err);
    return [];
  }
};

/**
 * Сохраняет локальный снимок коллекции. Возвращает false при отказе записи
 * (переполнение или заблокированное хранилище) — вызывающий код обязан
 * сообщить об этом пользователю, а не делать вид, что данные сохранены.
 */
export const saveLocalCollection = <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
): boolean => {
  try {
    localStorage.setItem(storageKeyFor(collectionName, userId), JSON.stringify(items));
    return true;
  } catch (err) {
    console.error(`[dataStore] не удалось сохранить локальную коллекцию ${collectionName}:`, err);
    return false;
  }
};

export const clearCollectionData = (collectionName: string, userId?: string): void => {
  try {
    localStorage.removeItem(storageKeyFor(collectionName, userId));
  } catch (err) {
    console.error(`[dataStore] не удалось удалить локальную коллекцию ${collectionName}:`, err);
  }
};

export const clearLocalData = (userId?: string): void => {
  for (const collectionName of ALL_COLLECTIONS) {
    clearCollectionData(collectionName, userId);
  }
};

export const clearUserLocalData = (userId: string): void => {
  const prefixes = [`denegnyj_put_${userId}_`, `denegnyj_put_pending_${userId}_`];
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error('[dataStore] не удалось очистить локальные данные аккаунта:', err);
  }
};
