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

const readPendingQueue = (key: string): PendingCollectionOperation[] => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((entry) =>
      !entry || typeof entry !== 'object' || typeof entry.id !== 'string' ||
      !['upsert', 'delete', 'clear'].includes(entry.type) ||
      (entry.type === 'upsert' && (!entry.item || typeof entry.item.id !== 'string')) ||
      (entry.type === 'delete' && typeof entry.itemId !== 'string'),
    )) {
      throw new Error('Формат очереди синхронизации повреждён');
    }
    return parsed as PendingCollectionOperation[];
  } catch (err) {
    throw new Error('Не удалось прочитать очередь синхронизации', { cause: err });
  }
};

const writePendingQueue = (key: string, operations: PendingCollectionOperation[]) => {
  try {
    if (operations.length) localStorage.setItem(key, JSON.stringify(operations));
    else localStorage.removeItem(key);
  } catch (err) {
    throw new Error('Не удалось сохранить очередь синхронизации на устройстве', { cause: err });
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
  operations.push({ id: crypto.randomUUID(), type: 'upsert', item });
  writePendingQueue(key, operations);
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
  operations.push({ id: crypto.randomUUID(), type: 'delete', itemId });
  writePendingQueue(key, operations);
};

export const enqueueCollectionClear = (name: FirestoreCollection, userId: string) => {
  writePendingQueue(pendingCollectionKey(name, userId), [
    { id: crypto.randomUUID(), type: 'clear' },
  ]);
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
  try {
    const raw = localStorage.getItem(storageKeyFor(COLLECTIONS.budgetPlan, userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, updatedAt: '' };
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) return null;
    const plan = parsed as { items: unknown[]; updatedAt?: unknown };
    return { items: plan.items, updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : '' };
  } catch {
    return null;
  }
};

export const enqueueBudgetPlan = (userId: string, items: unknown[], updatedAt: string) => {
  try {
    localStorage.setItem(pendingBudgetKey(userId), JSON.stringify({
      id: crypto.randomUUID(),
      items,
      updatedAt,
    } satisfies PendingBudgetPlan));
  } catch (err) {
    throw new Error('Не удалось сохранить план в очередь синхронизации', { cause: err });
  }
};

export const getPendingBudgetPlan = (userId: string): PendingBudgetPlan | null => {
  try {
    const raw = localStorage.getItem(pendingBudgetKey(userId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Формат очереди плана повреждён');
    const plan = parsed as Partial<PendingBudgetPlan>;
    if (typeof plan.id !== 'string' || !Array.isArray(plan.items)) {
      throw new Error('Формат очереди плана повреждён');
    }
    return { id: plan.id, items: plan.items, updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : '' };
  } catch (err) {
    throw new Error('Не удалось прочитать очередь синхронизации плана', { cause: err });
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
  try {
    const raw = localStorage.getItem(storageKeyFor(collectionName, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const saveLocalCollection = <T extends { id: string }>(collectionName: string, items: T[], userId?: string) => {
  try {
    localStorage.setItem(storageKeyFor(collectionName, userId), JSON.stringify(items));
  } catch {
    // ignore
  }
};

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
    localStorage.removeItem(storageKeyFor(collectionName, userId));
  } catch {
    // ignore
  }
};

export const clearLocalData = (userId?: string): void => {
  for (const collectionName of ALL_COLLECTIONS) {
    clearCollectionData(collectionName, userId);
  }
};

export const clearUserLocalData = (userId: string): void => {
  const prefixes = [`denegnyj_put_${userId}_`, `denegnyj_put_pending_${userId}_`];
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
  if (getResetPendingUserId() === userId) clearResetPending();
  localStorage.removeItem('denegnyj_put_auth_uid');
};
