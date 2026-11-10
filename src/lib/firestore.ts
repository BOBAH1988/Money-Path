import { clearFirestorePersistence, getFirebaseError, getFirestoreDb } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  getDocFromServer,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  ALL_COLLECTIONS,
  type FirestoreCollection,
  colPath,
  storageKeyFor,
  loadLocalCollection,
  saveLocalCollection,
  enqueueCollectionUpsert,
  enqueueCollectionDelete,
  enqueueCollectionClear,
  getPendingCollectionOperations,
  removePendingCollectionOperation,
  enqueueBudgetPlan,
  getPendingBudgetPlan,
  clearPendingBudgetPlan,
  saveLocalBudgetPlan,
  loadLocalBudgetPlan,
  clearLocalData,
  isResetPending,
  getResetPendingUserId,
  clearResetPending,
  clearCollectionData,
  clearUserLocalData,
} from './dataStore';
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from './legal';

export {
  COLLECTIONS,
  ALL_COLLECTIONS,
  colPath,
  storageKeyFor,
  loadLocalCollection,
  saveLocalCollection,
  enqueueCollectionUpsert,
  enqueueCollectionDelete,
  enqueueCollectionClear,
  getPendingCollectionOperations,
  removePendingCollectionOperation,
  enqueueBudgetPlan,
  getPendingBudgetPlan,
  clearPendingBudgetPlan,
  saveLocalBudgetPlan,
  loadLocalBudgetPlan,
  clearLocalData,
  isResetPending,
  getResetPendingUserId,
  clearResetPending,
  clearCollectionData,
  clearUserLocalData,
};
export type { FirestoreCollection };

export const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getSnapshotFast = async <T extends { id: string }>(
  q: Query<DocumentData> | ReturnType<typeof collection>,
  onFresh?: (items: T[]) => void,
): Promise<T[]> => {
  let cachedItems: T[] | null = null;
  try {
    const cached = await getDocsFromCache(q);
    cachedItems = cached.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<T, 'id'> & Record<string, unknown>;
      return { ...data, id: docSnap.id } as T;
    });
  } catch {
    // cache miss / unavailable
  }

  const loadServer = async () => {
    try {
      const snap = await withTimeout(getDocsFromServer(q), 8000, 'getDocsFromServer');
      const fresh = snap.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<T, 'id'> & Record<string, unknown>;
      return { ...data, id: docSnap.id } as T;
      });
      onFresh?.(fresh);
      return fresh;
    } catch (err) {
      console.error('[firestore] getDocsFromServer ошибка:', err);
      if (cachedItems !== null) return cachedItems;
      throw err;
    }
  };

  if (cachedItems) {
    void loadServer();
    return cachedItems;
  }

  return loadServer();
};

export const trackUser = async (uid: string, email: string): Promise<void> => {
  try {
    const firestoreDb = await getFirestoreDb();
    const userRef = doc(firestoreDb, 'users', uid);
    const snap = await getDoc(userRef);
    const now = new Date().toISOString();
    if (!snap.exists()) {
      await setDoc(userRef, { uid, email, createdAt: now, lastActive: now });
    } else {
      await setDoc(userRef, { ...snap.data(), email, lastActive: now }, { merge: true });
    }
  } catch (err) {
    console.error(`[firestore] trackUser uid=${uid} ошибка:`, err);
  }
};

export const recordLegalConsent = async (uid: string): Promise<void> => {
  const firestoreDb = await getFirestoreDb();
  await setDoc(doc(firestoreDb, 'users', uid), {
    acceptedTermsVersion: TERMS_VERSION,
    acceptedPrivacyVersion: PRIVACY_NOTICE_VERSION,
    consentUpdatedAt: new Date().toISOString(),
  }, { merge: true });
};

export const getLegalConsent = async (
  uid: string,
): Promise<{ termsVersion: string; privacyVersion: string }> => {
  const firestoreDb = await getFirestoreDb();
  const snapshot = await getDocFromServer(doc(firestoreDb, 'users', uid));
  const data = snapshot.data() ?? {};
  return {
    termsVersion: typeof data.acceptedTermsVersion === 'string' ? data.acceptedTermsVersion : '',
    privacyVersion: typeof data.acceptedPrivacyVersion === 'string' ? data.acceptedPrivacyVersion : '',
  };
};

export const deleteAccountData = async (userId: string): Promise<void> => {
  if (!userId) throw new Error('Не удалось определить аккаунт для удаления');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Для удаления аккаунта необходимо подключение к интернету');
  }

  const firestoreDb = await getFirestoreDb();
  for (const name of ALL_COLLECTIONS) {
    const collectionRef = collection(firestoreDb, colPath(name, userId));
    while (true) {
      const snapshot = await withTimeout(
        getDocsFromServer(collectionRef),
        15000,
        `deleteAccount(${name})`,
      );
      if (snapshot.empty) break;
      for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
        const batch = writeBatch(firestoreDb);
        snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
        await withTimeout(batch.commit(), 15000, `deleteAccount(${name})`);
      }
    }
  }

  await deleteDoc(doc(firestoreDb, 'budget_plan', `users/${userId}/budget_plan`));
  await deleteDoc(doc(firestoreDb, 'users', userId));
  clearUserLocalData(userId);
  try {
    await clearFirestorePersistence();
  } catch (err) {
    const reason = err instanceof Error ? ` (${err.message})` : '';
    throw new Error(
      `Облачные данные и локальные записи удалены, но кэш Firestore не очищен${reason}. Закройте другие вкладки, перезагрузите страницу и повторите удаление аккаунта.`,
      { cause: err },
    );
  }
};

export const getAllUsers = async (currentUid?: string): Promise<{ uid: string; email: string; createdAt: string; lastActive: string }[]> => {
  const firestoreDb = await getFirestoreDb();
  try {
    const snapshot = await getDocs(collection(firestoreDb, 'users'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        uid: docSnap.id,
        email: String(data.email ?? ''),
        createdAt: String(data.createdAt ?? ''),
        lastActive: String(data.lastActive ?? ''),
      };
    });
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code) : '';
    console.error('[firestore] getAllUsers ошибка:', err);
    if (code === 'permission-denied' && currentUid) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'users', currentUid));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          return [{
            uid: currentUid,
            email: String(data.email ?? ''),
            createdAt: String(data.createdAt ?? ''),
            lastActive: String(data.lastActive ?? ''),
          }];
        }
      } catch {
        // ignore fallback error
      }
      throw new Error('Нет доступа к списку пользователей. Для полной аналитики опубликуйте правила из firestore.rules; сейчас показаны только данные вашего аккаунта (если доступны).');
    }
    if (code === 'permission-denied') {
      throw new Error('Нет доступа к аналитике: опубликуйте правила Firestore, разрешающие администратору чтение коллекции users (см. firestore.rules).');
    }
    throw err instanceof Error ? err : new Error('Не удалось загрузить аналитику');
  }
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[],
  userId?: string,
) => {
  if (!userId) return;
  try {
    const existing = loadLocalCollection<T>(collectionName, userId);
    const merged = new Map(existing.map((item) => [item.id, item]));
    for (const item of items) {
      merged.set(item.id, item);
      enqueueCollectionUpsert(collectionName as FirestoreCollection, userId, item);
    }
    saveLocalCollection(collectionName, [...merged.values()], userId);
    await syncPendingToFirestore(userId);
  } catch (err) {
    console.error(`[firestore] saveToFirestore(${collectionName}) ошибка:`, err);
    throw err;
  }
};

export const deleteFromFirestore = async (collectionName: string, id: string, userId?: string) => {
  if (!userId) return;
  try {
    enqueueCollectionDelete(collectionName as FirestoreCollection, userId, id);
    await syncPendingToFirestore(userId);
  } catch (err) {
    console.error(`[firestore] deleteFromFirestore(${collectionName}, id=${id}) ошибка:`, err);
    throw err;
  }
};

export const clearFirestoreCollection = async (collectionName: FirestoreCollection, userId?: string) => {
  if (!userId) {
    clearCollectionData(collectionName);
    return;
  }
  enqueueCollectionClear(collectionName, userId);
  saveLocalCollection(collectionName, [], userId);
  await syncPendingToFirestore(userId);
};

export const clearAccountData = async (userId?: string) => {
  if (!userId) {
    clearLocalData();
    return { synced: true };
  }
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
    console.error('[firestore] clearAccountData: очистка поставлена в очередь:', err);
    return { synced: false, error: err instanceof Error ? err.message : 'Ожидание подключения' };
  }
};

export const loadFromFirestore = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
  onFresh?: (items: T[]) => void,
): Promise<T[]> => {
  if (!userId) return [];
  try {
    const firestoreDb = await getFirestoreDb();
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    return await getSnapshotFast<T>(colRef, onFresh);
  } catch (err) {
    console.error(`[firestore] loadFromFirestore(${collectionName}) ошибка:`, err);
    throw err instanceof Error ? err : new Error('Не удалось загрузить данные');
  }
};

const budgetPlanDocRef = (firestoreDb: Firestore, userId: string) =>
  doc(firestoreDb, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan');
const budgetPlanDocRefLegacy = (firestoreDb: Firestore, userId: string) =>
  doc(firestoreDb, COLLECTIONS.budgetPlan, `users/${userId}/budget_plan`);

export const loadBudgetPlan = async (
  userId?: string,
  onFresh?: (data: { items: unknown[]; updatedAt: string }) => void,
): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId) {
    return { items: [], updatedAt: '' };
  }
  const firestoreDb = await getFirestoreDb();
  try {
    const read = async (ref: ReturnType<typeof doc>) => {
      try {
        const cached = await getDocFromCache(ref);
        if (cached.exists()) {
          const data = cached.data() as { items?: unknown[]; updatedAt?: string };
          void withTimeout(getDocFromServer(ref), 8000, 'getDocFromServer')
            .then((snap) => {
              if (!snap.exists()) {
                onFresh?.({ items: [], updatedAt: '' });
                return;
              }
              const fresh = snap.data() as { items?: unknown[]; updatedAt?: string };
              onFresh?.({ items: fresh.items ?? [], updatedAt: fresh.updatedAt ?? '' });
            })
            .catch((err) => console.error('[firestore] loadBudgetPlan refresh ошибка:', err));
          return { items: data.items ?? [], updatedAt: data.updatedAt ?? '' };
        }
      } catch {
        // cache miss
      }
      const snap = await withTimeout(getDocFromServer(ref), 8000, 'getDocFromServer');
      if (snap.exists()) {
        const data = snap.data() as { items?: unknown[]; updatedAt?: string };
        const fresh = { items: data.items ?? [], updatedAt: data.updatedAt ?? '' };
        onFresh?.(fresh);
        return fresh;
      }
      return null;
    };
    const primary = await read(budgetPlanDocRef(firestoreDb, userId));
    if (primary) return primary;
    const legacy = await read(budgetPlanDocRefLegacy(firestoreDb, userId));
    if (legacy) return legacy;
    return { items: [], updatedAt: '' };
  } catch (err) {
    console.error('[firestore] loadBudgetPlan ошибка:', err);
    throw err instanceof Error ? err : new Error('Не удалось загрузить план бюджета');
  }
};

export const saveBudgetPlan = async (userId?: string, items: unknown[] = [], updatedAt = new Date().toISOString()) => {
  if (!userId) return;
  try {
    enqueueBudgetPlan(userId, items, updatedAt);
    saveLocalBudgetPlan(items, userId, updatedAt);
    await syncPendingToFirestore(userId);
  } catch (err) {
    console.error('[firestore] saveBudgetPlan ошибка:', err);
    throw err;
  }
};

export const resetBudgetPlan = async (userId?: string): Promise<{ items: unknown[]; updatedAt: string }> => {
  const updatedAt = new Date().toISOString();
  await saveBudgetPlan(userId, [], updatedAt);
  return { items: [], updatedAt };
};

const syncLocks = new Map<string, Promise<void>>();

const applyClearOperation = async (name: FirestoreCollection, userId: string) => {
  const firestoreDb = await getFirestoreDb();
  const colRef = collection(firestoreDb, colPath(name, userId));
  const snapshot = await withTimeout(getDocsFromServer(colRef), 8000, `getDocsFromServer(${name})`);
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = writeBatch(firestoreDb);
    snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await withTimeout(batch.commit(), 8000, `clearCollection(${name})`);
  }
};

const runPendingSync = async (userId: string) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Нет подключения к интернету. Изменения сохранены на устройстве.');
  }
  const firestoreDb = await getFirestoreDb();

  for (const name of ALL_COLLECTIONS) {
    if (name === COLLECTIONS.budgetPlan) continue;
    while (true) {
      const operation = getPendingCollectionOperations(name, userId)[0];
      if (!operation) break;
      try {
        if (operation.type === 'upsert') {
          await withTimeout(
            setDoc(doc(firestoreDb, colPath(name, userId), operation.item.id), {
              ...operation.item,
              userId,
              updatedAt: new Date().toISOString(),
            } as DocumentData),
            8000,
            `save(${name})`,
          );
        } else if (operation.type === 'delete') {
          await withTimeout(
            deleteDoc(doc(firestoreDb, colPath(name, userId), operation.itemId)),
            8000,
            `delete(${name})`,
          );
        } else {
          await applyClearOperation(name, userId);
        }
        removePendingCollectionOperation(name, userId, operation.id);
      } catch (err) {
        console.error(`[firestore] syncPendingToFirestore(${name}) ошибка:`, err);
        throw err instanceof Error ? err : new Error(`Не удалось синхронизировать ${name}`);
      }
    }
  }

  while (true) {
    const pendingPlan = getPendingBudgetPlan(userId);
    if (!pendingPlan) break;
    try {
      await withTimeout(
        setDoc(budgetPlanDocRef(firestoreDb, userId), {
          items: pendingPlan.items,
          updatedAt: pendingPlan.updatedAt,
          userId,
        }),
        8000,
        'save(budget_plan)',
      );
      clearPendingBudgetPlan(userId, pendingPlan.id);
    } catch (err) {
      console.error('[firestore] syncPendingToFirestore(budget_plan) ошибка:', err);
      throw err instanceof Error ? err : new Error('Не удалось синхронизировать план бюджета');
    }
  }
};

export const syncPendingToFirestore = (userId?: string): Promise<void> => {
  if (!userId) return Promise.resolve();
  const existing = syncLocks.get(userId);
  if (existing) return existing;
  const pending = runPendingSync(userId).finally(() => syncLocks.delete(userId));
  syncLocks.set(userId, pending);
  return pending;
};

export { getFirestoreDb, getFirebaseError as firebaseError };
