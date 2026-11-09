import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(() => {}),
  collection: vi.fn(() => {}),
  doc: vi.fn(() => {}),
  getDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  getDocs: mocks.getDocs,
  query: mocks.query,
  orderBy: mocks.orderBy,
  getDoc: mocks.getDoc,
}));

vi.mock('./firebase', () => ({
  firestoreDb: {},
  firebaseError: null,
}));

import { saveToFirestore, loadFromFirestore, loadBudgetPlan, saveBudgetPlan, resetBudgetPlan } from './firestore';

describe('saveToFirestore', () => {
  const userId = 'uid-123';
  const collectionName = 'assets';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('saves all items as documents', async () => {
    const items = [
      { id: '1', name: 'Item 1', amount: 100 },
      { id: '2', name: 'Item 2', amount: 200 },
    ];
    mocks.getDocs.mockResolvedValue({ docs: [] });

    await saveToFirestore(collectionName, items, userId);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(2);
    expect(mocks.deleteDoc as any).not.toHaveBeenCalled();
  });

  it('does not call deleteDoc when nothing was removed', async () => {
    const items = [{ id: '1', name: 'Item 1', amount: 100 }];
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', ref: {} },
        { id: '2', ref: {} },
      ],
    });

    await saveToFirestore(collectionName, items, userId);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDoc as any).not.toHaveBeenCalled();
  });

  it('saves nothing to Firestore when local array is empty', async () => {
    const items: { id: string; name: string; amount: number }[] = [];
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', ref: {} },
        { id: '2', ref: {} },
        { id: '3', ref: {} },
      ],
    });

    await saveToFirestore(collectionName, items, userId);

    expect(mocks.setDoc as any).not.toHaveBeenCalled();
    expect(mocks.deleteDoc as any).not.toHaveBeenCalled();
  });

  it('does nothing with Firestore when userId is missing', async () => {
    const items = [{ id: '1', name: 'Item 1', amount: 100 }];

    await saveToFirestore(collectionName, items, undefined);

    expect(mocks.setDoc as any).not.toHaveBeenCalled();
    expect(mocks.deleteDoc as any).not.toHaveBeenCalled();
    expect(mocks.getDocs as any).not.toHaveBeenCalled();
  });
});

describe('loadFromFirestore', () => {
  const userId = 'uid-123';
  const collectionName = 'assets';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('returns empty array when userId is missing', async () => {
    const data = await loadFromFirestore(collectionName, undefined);
    expect(data.length).toBe(0);
  });

  it('returns documents from Firestore as records with id', async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', data: () => ({ id: '1', name: 'Item 1', amount: 100 }) },
        { id: '2', data: () => ({ id: '2', name: 'Item 2', amount: 200 }) },
      ],
    });

    const data = await loadFromFirestore<{ id: string; name: string; amount: number }>(collectionName, userId);

    expect(data.length).toBe(2);
    expect(data[0].id).toBe('1');
    expect(data[0].name).toBe('Item 1');
    expect(data[1].amount).toBe(200);
  });

  it('returns empty array when Firestore snapshot has no docs', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] });

    const data = await loadFromFirestore(collectionName, userId);

    expect(data.length).toBe(0);
  });
});

describe('loadBudgetPlan', () => {
  const userId = 'uid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('returns plan items from Firestore', async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ items: [{ id: '1', name: 'Test', amount: 100, plan: 50, group: 'monthly', type: 'item' }], updatedAt: '2026-01-01T00:00:00.000Z' }),
    });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items).toHaveLength(1);
    expect((plan.items[0] as { id: string }).id).toBe('1');
    expect(mocks.setDoc as any).not.toHaveBeenCalled();
  });

  it('returns empty plan when document does not exist', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items).toEqual([]);
  });
});

describe('saveBudgetPlan', () => {
  const userId = 'uid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('saves plan items to Firestore', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true });

    await saveBudgetPlan(userId, [{ id: '1', name: 'Test', amount: 100, plan: 50, group: 'monthly', type: 'item' }]);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(1);
  });

  it('does nothing when userId is missing', async () => {
    await saveBudgetPlan(undefined, [{ id: '1', name: 'Test', amount: 100, plan: 50, group: 'monthly', type: 'item' }]);
    expect(mocks.setDoc as any).not.toHaveBeenCalled();
  });
});

describe('resetBudgetPlan', () => {
  const userId = 'uid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('saves empty plan to Firestore', async () => {
    await resetBudgetPlan(userId);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(1);
  });

  it('does nothing when userId is missing', async () => {
    await resetBudgetPlan(undefined);
    expect(mocks.setDoc as any).not.toHaveBeenCalled();
  });
});
