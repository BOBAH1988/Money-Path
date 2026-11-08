import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(() => {}),
  collection: vi.fn(() => {}),
  doc: vi.fn(() => {}),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  getDocs: mocks.getDocs,
  query: mocks.query,
  orderBy: mocks.orderBy,
}));

vi.mock('./firebase', () => ({
  firestoreDb: {},
  firebaseError: null,
}));

import { saveToFirestore, loadFromFirestore } from './firestore';

describe('saveToFirestore', () => {
  const userId = 'uid-123';
  const collectionName = 'assets';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('saves all items and does not call deleteDoc when nothing was removed', async () => {
    const items = [
      { id: '1', name: 'Item 1', amount: 100 },
      { id: '2', name: 'Item 2', amount: 200 },
    ];
    mocks.getDocs.mockResolvedValue({ docs: [] });

    await saveToFirestore(collectionName, items, userId);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(2);
    expect(mocks.deleteDoc as any).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(`denegnyj_put_${userId}_${collectionName}`) || '[]');
    expect(stored.length).toBe(2);
  });

  it('deletes from Firestore documents that are no longer in the local array', async () => {
    const items = [{ id: '1', name: 'Item 1', amount: 100 }];
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', ref: {} },
        { id: '2', ref: {} },
      ],
    });

    await saveToFirestore(collectionName, items, userId);

    expect(mocks.setDoc as any).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDoc as any).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDoc as any).toHaveBeenCalledWith({});
    const stored = JSON.parse(localStorage.getItem(`denegnyj_put_${userId}_${collectionName}`) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('1');
  });

  it('deletes all documents when local array is empty', async () => {
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
    expect(mocks.deleteDoc as any).toHaveBeenCalledTimes(3);
    const stored = JSON.parse(localStorage.getItem(`denegnyj_put_${userId}_${collectionName}`) || '[]');
    expect(stored.length).toBe(0);
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
    localStorage.clear();
    mocks.collection.mockReturnValue({} as any);
    mocks.doc.mockReturnValue({} as any);
    mocks.query.mockReturnValue({} as any);
  });

  it('prioritizes localStorage over Firestore so deleted rows do not reappear', async () => {
    // В localStorage только один элемент (item 2 удалён пользователем)
    localStorage.setItem(
      `denegnyj_put_${userId}_${collectionName}`,
      JSON.stringify([{ id: '1', name: 'Item 1', amount: 100 }])
    );

    // В Firestore всё ещё есть оба элемента (включая удалённый item 2)
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', data: () => ({ id: '1', name: 'Item 1', amount: 100 }) },
        { id: '2', data: () => ({ id: '2', name: 'Item 2', amount: 200 }) },
      ],
    });

    const data = await loadFromFirestore(collectionName, userId);

    expect(data.length).toBe(1);
    expect(data[0].id).toBe('1');
    // Firestore данные не перезаписали localStorage
    const stored = JSON.parse(localStorage.getItem(`denegnyj_put_${userId}_${collectionName}`) || '[]');
    expect(stored.length).toBe(1);
  });

  it('loads from Firestore when localStorage is empty', async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: '1', data: () => ({ id: '1', name: 'Item 1', amount: 100 }) },
      ],
    });

    const data = await loadFromFirestore(collectionName, userId);

    expect(data.length).toBe(1);
    expect(data[0].id).toBe('1');
  });

  it('returns empty array when both localStorage and Firestore are empty', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] });

    const data = await loadFromFirestore(collectionName, userId);

    expect(data.length).toBe(0);
  });

  it('returns empty array when userId is missing', async () => {
    const data = await loadFromFirestore(collectionName, undefined);
    expect(data.length).toBe(0);
  });
});
