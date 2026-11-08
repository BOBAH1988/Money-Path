import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadFromFirestore: vi.fn(),
  saveToFirestore: vi.fn(),
  loadBudgetPlan: vi.fn(),
  saveBudgetPlan: vi.fn(),
}));

vi.mock('./firestore', () => ({
  loadFromFirestore: mocks.loadFromFirestore,
  saveToFirestore: mocks.saveToFirestore,
  COLLECTIONS: {
    assets: 'assets',
    liabilities: 'liabilities',
    income: 'income',
    incomeArchive: 'income_archive',
    budgetPlan: 'budget_plan',
  },
}));

vi.mock('./budget', () => ({
  loadBudgetPlan: mocks.loadBudgetPlan,
  saveBudgetPlan: mocks.saveBudgetPlan,
}));

import {
  exportBackup,
  restoreBackup,
  parseBackupFile,
  downloadBackup,
  backupFileName,
  BACKUP_COLLECTIONS,
  BACKUP_VERSION,
} from './backup';
import type { BudgetPlan } from '../types';
import type { BackupArchive } from './backup';

const userId = 'uid-123';

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}`, amount: 100 }));

const emptyPlan: BudgetPlan = { items: [], updatedAt: '2026-01-01T00:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadBudgetPlan.mockResolvedValue(emptyPlan);
  mocks.saveBudgetPlan.mockResolvedValue(undefined);
});

describe('exportBackup', () => {
  it('собирает все коллекции и бюджет в архив', async () => {
    mocks.loadFromFirestore
      .mockResolvedValueOnce(makeItems(2)) // assets
      .mockResolvedValueOnce(makeItems(1)) // liabilities
      .mockResolvedValueOnce([]) // income
      .mockResolvedValueOnce([]); // incomeArchive

    const archive = await exportBackup(userId);

    expect(archive.version).toBe(BACKUP_VERSION);
    expect(archive.userId).toBe(userId);
    expect(archive.source).toBe('firestore');
    expect(archive.collections.assets.length).toBe(2);
    expect(archive.collections.liabilities.length).toBe(1);
    expect(archive.collections.income.length).toBe(0);
    expect(archive.collections['income_archive'].length).toBe(0);
    expect(archive.budgetPlan).toEqual(emptyPlan);
    expect(mocks.loadBudgetPlan).toHaveBeenCalledWith(userId);
  });

  it('обрабатывает пустые коллекции', async () => {
    mocks.loadFromFirestore.mockResolvedValue([]);
    const archive = await exportBackup(userId);
    expect(BACKUP_COLLECTIONS.every((c) => Array.isArray(archive.collections[c]))).toBe(true);
  });

  it('бросает ошибку без userId', async () => {
    await expect(exportBackup('')).rejects.toThrow(/userId/);
    await expect(exportBackup(undefined as unknown as string)).rejects.toThrow(/userId/);
  });
});

describe('restoreBackup', () => {
  it('восстанавливает коллекции и бюджет, возвращает отчёт', async () => {
    const archive = {
      version: BACKUP_VERSION,
      userId,
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'firestore',
      collections: {
        assets: makeItems(2),
        liabilities: makeItems(1),
        income: [],
        'income_archive': [],
      },
      budgetPlan: { items: [{ id: 'b1', name: 'Бudget', amount: 100, plan: 100, group: 'monthly', type: 'item' }], updatedAt: '2026-01-01T00:00:00.000Z' },
    } as unknown as BackupArchive;

    const report = await restoreBackup(archive, userId);

    expect(report.totalRecords).toBe(3);
    expect(report.restoredCollections.assets).toBe(2);
    expect(report.restoredCollections.liabilities).toBe(1);
    expect(report.budgetPlanRestored).toBe(true);

    expect(mocks.saveToFirestore).toHaveBeenCalledWith('assets', archive.collections['assets'], userId);
    expect(mocks.saveToFirestore).toHaveBeenCalledWith('liabilities', archive.collections['liabilities'], userId);
    expect(mocks.saveToFirestore).toHaveBeenCalledWith('income', [], userId);
    expect(mocks.saveToFirestore).toHaveBeenCalledWith('income_archive', [], userId);
    expect(mocks.saveBudgetPlan).toHaveBeenCalledWith(archive.budgetPlan, userId);
  });

  it('использует archive.userId, когда userId не передан', async () => {
    const archive = {
      version: BACKUP_VERSION,
      userId,
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'firestore',
      collections: { assets: [], liabilities: [], income: [], 'income_archive': [] },
      budgetPlan: null,
    } as unknown as BackupArchive;

    await restoreBackup(archive);
    expect(mocks.saveToFirestore).toHaveBeenCalledWith('assets', [], userId);
    expect(mocks.saveBudgetPlan).not.toHaveBeenCalled();
  });

  it('бросает ошибку без userId и без archive.userId', async () => {
    const archive = {
      version: BACKUP_VERSION,
      userId: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'firestore',
      collections: { assets: [], liabilities: [], income: [], 'income_archive': [] },
      budgetPlan: null,
    } as unknown as BackupArchive;
    await expect(restoreBackup(archive)).rejects.toThrow(/userId/);
  });
});

describe('parseBackupFile', () => {
  it('парсит валидный архив из файла', async () => {
    const archive = {
      version: BACKUP_VERSION,
      userId,
      createdAt: 'x',
      collections: { assets: [], liabilities: [], income: [], 'income_archive': [] },
      budgetPlan: null,
    } as unknown as BackupArchive;

    const file = new File([JSON.stringify(archive)], 'backup.json', { type: 'application/json' });
    const parsed = await parseBackupFile(file);
    expect(parsed.userId).toBe(userId);
    expect(parsed.version).toBe(BACKUP_VERSION);
  });

  it('бросает ошибку на некорректный JSON', async () => {
    const file = new File(['{not json'], 'bad.json');
    await expect(parseBackupFile(file)).rejects.toThrow(/JSON/);
  });

  it('бросает ошибку на неверную версию', async () => {
    const archive = { version: 99, userId, createdAt: 'x', collections: {}, budgetPlan: null };
    const file = new File([JSON.stringify(archive)], 'v.json');
    await expect(parseBackupFile(file)).rejects.toThrow(/версия/);
  });

  it('бросает ошибку на отсутствующую коллекцию', async () => {
    const archive = { version: BACKUP_VERSION, userId, createdAt: 'x', collections: { assets: [] }, budgetPlan: null };
    const file = new File([JSON.stringify(archive)], 'v.json');
    await expect(parseBackupFile(file)).rejects.toThrow(/отсутствует коллекция/);
  });
});

describe('backupFileName', () => {
  it('генерирует имя с userId и временной меткой', () => {
    const name = backupFileName('user-1');
    expect(name).toMatch(/^money-path-backup-user-1-/);
    expect(name).toMatch(/\.json$/);
    expect(name.match(/\d{4}-\d{2}-\d{2}-\d{6}/)).toBeTruthy();
  });
});

describe('downloadBackup', () => {
  it('создаёт ссылку для скачивания и удаляет её из DOM', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    const archive = {
      version: BACKUP_VERSION,
      userId,
      createdAt: '2026-01-01T00:00:00.000Z',
      source: 'firestore',
      collections: { assets: [], liabilities: [], income: [], 'income_archive': [] },
      budgetPlan: null,
    } as unknown as BackupArchive;

    downloadBackup(archive);

    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
