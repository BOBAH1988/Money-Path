import { ALL_COLLECTIONS, COLLECTIONS, storageKeyFor, type FirestoreCollection } from './dataStore';
import { loadFromFirestore, saveToFirestore } from './firestore';

export const BACKUP_VERSION = 1;

/**
 * Коллекции, которые входят в архивную копию.
 * budgetPlan хранится отдельным документом, а не коллекцией.
 */
export const BACKUP_COLLECTIONS: FirestoreCollection[] = [
  COLLECTIONS.assets,
  COLLECTIONS.liabilities,
  COLLECTIONS.income,
  COLLECTIONS.incomeArchive,
];

export interface BackupArchive {
  version: number;
  userId: string;
  createdAt: string;
  source: 'firestore' | 'local';
  collections: Record<string, unknown[]>;
  budgetPlan: BudgetPlan | null;
}

export interface BackupMeta {
  fileName: string;
  createdAt: string;
  userId: string;
  recordsCount: number;
}

export interface RestoreReport {
  restoredCollections: Record<string, number>;
  budgetPlanRestored: boolean;
  totalRecords: number;
}

/**
 * Собирает архивную копию всех данных пользователя из Firestore (с fallback в localStorage).
 */
export const exportBackup = async (userId: string): Promise<BackupArchive> => {
  if (!userId) {
    throw new Error('userId обязателен для создания резервной копии');
  }

  const collections: Record<string, unknown[]> = {};
  let recordsCount = 0;

  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = await loadFromFirestore<{ id: string }>(collectionName, userId);
    collections[collectionName] = items;
    recordsCount += items.length;
  }

  const budgetPlan = await loadBudgetPlan(userId);

  return {
    version: BACKUP_VERSION,
    userId,
    createdAt: new Date().toISOString(),
    source: 'firestore',
    collections,
    budgetPlan,
  };
};

/**
 * Проверяет, что объект соответствует структуре архивной копии.
 * Бросает Error с описанием при несоответствии.
 */
const validateArchive = (archive: unknown): BackupArchive => {
  if (!archive || typeof archive !== 'object') {
    throw new Error('Архив должен быть объектом JSON');
  }

  const a = archive as Record<string, unknown>;

  if (a.version !== BACKUP_VERSION) {
    throw new Error(`Неподдерживаемая версия архива: ${a.version}, ожидается ${BACKUP_VERSION}`);
  }

  if (typeof a.userId !== 'string' || !a.userId) {
    throw new Error('В архиве отсутствует userId');
  }

  if (typeof a.createdAt !== 'string' || !a.createdAt) {
    throw new Error('В архиве отсутствует createdAt');
  }

  if (!a.collections || typeof a.collections !== 'object' || Array.isArray(a.collections)) {
    throw new Error('В архиве отсутствуют коллекции');
  }

  const collections = a.collections as Record<string, unknown>;
  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = collections[collectionName];
    if (!Array.isArray(items)) {
      throw new Error(`В архиве отсутствует коллекция ${collectionName}`);
    }
  }

  if (a.budgetPlan !== null && a.budgetPlan !== undefined) {
    const bp = a.budgetPlan as unknown as BudgetPlan;
    if (!bp || !Array.isArray(bp.items)) {
      throw new Error('budgetPlan в архиве имеет неверную структуру');
    }
  }

  return a as unknown as BackupArchive;
};

/**
 * Читает и валидирует архивную копию из файла (браузерный File).
 */
export const parseBackupFile = async (file: File): Promise<BackupArchive> => {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Не удалось распарсить файл архива: некорректный JSON');
  }
  return validateArchive(parsed);
};

/**
 * Восстанавливает данные из архива в Firestore (и синхронно в localStorage через saveToFirestore).
 * Поддерживает частичное восстановление: коллекции, которых нет в архиве, не трогаются.
 */
export const restoreBackup = async (
  archive: BackupArchive,
  userId?: string
): Promise<RestoreReport> => {
  const targetUserId = userId ?? archive.userId;
  if (!targetUserId) {
    throw new Error('userId обязателен для восстановления');
  }

  const restoredCollections: Record<string, number> = {};

  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = archive.collections[collectionName];
    if (!Array.isArray(items)) continue;
    await saveToFirestore(collectionName, items as { id: string }[], targetUserId);
    restoredCollections[collectionName] = items.length;
  }

  let budgetPlanRestored = false;
  if (archive.budgetPlan && Array.isArray(archive.budgetPlan.items)) {
    await saveBudgetPlan(archive.budgetPlan, targetUserId);
    budgetPlanRestored = true;
  }

  const totalRecords = Object.values(restoredCollections).reduce((sum, n) => sum + n, 0);

  return {
    restoredCollections,
    budgetPlanRestored,
    totalRecords,
  };
};

export const restoreBackupLocally = (
  archive: BackupArchive,
  clearExisting = false,
): RestoreReport => {
  if (clearExisting) {
    for (const collectionName of ALL_COLLECTIONS) {
      localStorage.removeItem(storageKeyFor(collectionName));
    }
  }

  const restoredCollections: Record<string, number> = {};
  for (const collectionName of BACKUP_COLLECTIONS) {
    const items = archive.collections[collectionName];
    if (!Array.isArray(items)) continue;
    localStorage.setItem(storageKeyFor(collectionName), JSON.stringify(items));
    restoredCollections[collectionName] = items.length;
  }

  const budgetPlanRestored = Boolean(archive.budgetPlan && Array.isArray(archive.budgetPlan.items));
  if (budgetPlanRestored && archive.budgetPlan) {
    localStorage.setItem(storageKeyFor(COLLECTIONS.budgetPlan), JSON.stringify(archive.budgetPlan));
  }

  const totalRecords = Object.values(restoredCollections).reduce((sum, count) => sum + count, 0);
  return { restoredCollections, budgetPlanRestored, totalRecords };
};

/**
 * Сгенерировать имя файла архива: money-path-backup-<userId>-<YYYY-MM-DD>-<hhmmss>.json
 */
export const backupFileName = (userId: string): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `money-path-backup-${userId}-${stamp}.json`;
};

/**
 * Скачать архив как файл в браузере.
 */
export const downloadBackup = (archive: BackupArchive, fileName?: string): void => {
  const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? backupFileName(archive.userId);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

import { loadBudgetPlan, saveBudgetPlan } from './budget';
import type { BudgetPlan } from '../types';
