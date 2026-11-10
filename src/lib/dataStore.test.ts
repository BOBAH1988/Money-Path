import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollectionData,
  enqueueCollectionClear,
  enqueueCollectionDelete,
  enqueueCollectionUpsert,
  getPendingCollectionOperations,
  COLLECTIONS,
} from './dataStore';

describe('offline sync queue', () => {
  const userId = 'offline-queue-test-user';

  beforeEach(() => {
    localStorage.clear();
  });

  it('coalesces repeated edits to a record into the latest pending operation', () => {
    enqueueCollectionUpsert(COLLECTIONS.assets, userId, { id: 'asset-1', amount: 10 });
    enqueueCollectionUpsert(COLLECTIONS.assets, userId, { id: 'asset-1', amount: 20 });

    expect(getPendingCollectionOperations(COLLECTIONS.assets, userId)).toMatchObject([
      { type: 'upsert', item: { id: 'asset-1', amount: 20 } },
    ]);
  });

  it('keeps a delete queued after an offline edit', () => {
    enqueueCollectionUpsert(COLLECTIONS.assets, userId, { id: 'asset-1', amount: 10 });
    enqueueCollectionDelete(COLLECTIONS.assets, userId, 'asset-1');

    expect(getPendingCollectionOperations(COLLECTIONS.assets, userId)).toMatchObject([
      { type: 'delete', itemId: 'asset-1' },
    ]);
  });

  it('retains explicit empty-collection clears in the queue', () => {
    enqueueCollectionClear(COLLECTIONS.assets, userId);

    expect(getPendingCollectionOperations(COLLECTIONS.assets, userId)).toMatchObject([
      { type: 'clear' },
    ]);
  });

  it('clears only the requested account cache', () => {
    localStorage.setItem(`denegnyj_put_${userId}_assets`, '[{"id":"cloud"}]');
    localStorage.setItem('denegnyj_put_assets', '[{"id":"guest"}]');

    clearCollectionData(COLLECTIONS.assets, userId);

    expect(localStorage.getItem(`denegnyj_put_${userId}_assets`)).toBeNull();
    expect(localStorage.getItem('denegnyj_put_assets')).toBe('[{"id":"guest"}]');
  });
});
