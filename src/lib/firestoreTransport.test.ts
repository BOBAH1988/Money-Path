import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDocsFromCache: vi.fn(async () => {
    throw new Error('cache miss');
  }),
  getDocsFromServer: vi.fn(),
  getDocFromCache: vi.fn(async () => {
    throw new Error('cache miss');
  }),
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  clearFirestorePersistence: vi.fn(async () => undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __col: true })),
  doc: vi.fn(() => ({ __doc: true })),
  query: vi.fn(),
  orderBy: vi.fn(() => ({})),
  getDocs: mocks.getDocs,
  getDocsFromCache: mocks.getDocsFromCache,
  getDocsFromServer: mocks.getDocsFromServer,
  getDoc: vi.fn(),
  getDocFromCache: mocks.getDocFromCache,
  getDocFromServer: mocks.getDocFromServer,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  writeBatch: vi.fn(() => ({ delete: vi.fn(), commit: vi.fn(async () => undefined) })),
}));

vi.mock('./firebase', () => ({
  getFirestoreDb: vi.fn(async () => ({})),
  getFirebaseError: vi.fn(() => null),
  clearFirestorePersistence: mocks.clearFirestorePersistence,
  getIdToken: vi.fn(async () => 'token-1'),
}));

vi.mock('./backend', () => ({
  BACKEND_CONFIG: { backend: 'api', apiUrl: 'https://api.test', shadow: false, dualWrite: false },
  isApiBackend: () => true,
}));

import {
  deleteAccountData,
  enqueueCollectionUpsert,
  getPendingCollectionOperations,
  loadFromFirestore,
  loadLocalCollection,
  saveToFirestore,
  syncPendingToFirestore,
} from './firestore';
import { resetApiClient } from './apiBackend';

const jsonResponse = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
});

const fetchMock = vi.fn();

const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: (init as RequestInit | undefined)?.method,
  }));

const userId = 'uid-1';

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  resetApiClient();
  mocks.getDocs.mockReset();
  mocks.getDocsFromServer.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('фасад на api-бэкенде', () => {
  it('читает коллекцию из API, а не из Firestore', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ dataVersion: 'v1', items: [{ id: 'a1' }] }));

    const items = await loadFromFirestore<{ id: string }>('assets', userId);

    expect(items).toEqual([{ id: 'a1' }]);
    expect(calls()).toEqual([{ url: 'https://api.test/me/collections/assets', method: 'GET' }]);
    expect(mocks.getDocsFromServer).not.toHaveBeenCalled();
  });

  it('пишет элемент через очередь /me/sync и не трогает Firestore', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ dataVersion: 'v1', applied: [{ operationId: 'op-1', status: 'ok' }] }),
    );

    await saveToFirestore('assets', [{ id: 'a 1', amount: 5 }], userId);

    expect(calls()).toEqual([{ url: 'https://api.test/me/sync', method: 'POST' }]);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.operations).toEqual([
      {
        op: 'upsert',
        operationId: expect.any(String),
        collection: 'assets',
        item: { id: 'a 1', amount: 5 },
      },
    ]);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('отправляет накопленную очередь через /me/sync и очищает её', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ dataVersion: 'v2', applied: [{ operationId: 'op-1', status: 'ok' }] }),
    );
    enqueueCollectionUpsert('assets', userId, { id: 'a1' });

    await syncPendingToFirestore(userId);

    expect(calls()).toEqual([{ url: 'https://api.test/me/sync', method: 'POST' }]);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.operations).toEqual([
      { op: 'upsert', operationId: expect.any(String), collection: 'assets', item: { id: 'a1' } },
    ]);
    expect(getPendingCollectionOperations('assets', userId)).toEqual([]);
  });

  it('при удалении аккаунта вызывает DELETE /me и чистит локальные данные', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });
    await saveToFirestore('assets', [{ id: 'a1' }], userId);

    await deleteAccountData(userId);

    expect(calls().at(-1)).toEqual({ url: 'https://api.test/me', method: 'DELETE' });
    expect(loadLocalCollection('assets', userId)).toEqual([]);
  });
});
