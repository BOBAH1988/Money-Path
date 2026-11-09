import { firestoreDb, firebaseError } from './firebase';
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
  type DocumentData,
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
  loadLocalBudgetPlan,
  saveLocalBudgetPlan,
  isResetPending,
  getResetPendingUserId,
  clearResetPending,
  clearCollectionData,
} from './dataStore';

export {
  COLLECTIONS,
  ALL_COLLECTIONS,
  colPath,
  storageKeyFor,
  loadLocalCollection,
  saveLocalCollection,
  loadLocalBudgetPlan,
  saveLocalBudgetPlan,
  isResetPending,
  getResetPendingUserId,
  clearResetPending,
  clearCollectionData,
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

  const serverPromise = withTimeout(getDocsFromServer(q), 8000, 'getDocsFromServer')
    .then((snap) => snap.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<T, 'id'> & Record<string, unknown>;
      return { ...data, id: docSnap.id } as T;
    }))
    .then((fresh) => {
      onFresh?.(fresh);
      return fresh;
    })
    .catch((err) => {
      console.error('[firestore] getDocsFromServer ошибка:', err);
      return null;
    });

  if (cachedItems) {
    void serverPromise; // фоновое обновление
    return cachedItems;
  }

  const fresh = await withTimeout(serverPromise, 4500, 'getDocsFresh').catch(() => null);
  return fresh ?? [];
};

export const trackUser = async (uid: string, email: string): Promise<void> => {
  if (!firestoreDb) return;
  try {
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

export const getAllUsers = async (currentUid?: string): Promise<{ uid: string; email: string; createdAt: string; lastActive: string }[]> => {
  if (!firestoreDb) return [];
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
  const stamped = items.map((item) => ({ ...item, updatedAt: new Date().toISOString() } as T));
  if (!userId) return;
  if (!firestoreDb) return;
  const colRef = collection(firestoreDb, colPath(collectionName, userId));
  const batch = stamped.map((item) =>
    setDoc(doc(colRef, item.id), { ...item, userId } as DocumentData),
  );
  try {
    await Promise.all(batch);
  } catch (err) {
    console.error(`[firestore] saveToFirestore(${collectionName}) ошибка:`, err);
    throw err;
  }
};

export const deleteFromFirestore = async (collectionName: string, id: string, userId?: string) => {
  if (!userId || !firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, colPath(collectionName, userId), id));
  } catch (err) {
    console.error(`[firestore] deleteFromFirestore(${collectionName}, id=${id}) ошибка:`, err);
  }
};

export const loadFromFirestore = async <T extends { id: string }>(
  collectionName: string,
  userId?: string,
  onFresh?: (items: T[]) => void,
): Promise<T[]> => {
  if (!userId || !firestoreDb) return [];
  try {
    const colRef = collection(firestoreDb, colPath(collectionName, userId));
    return await getSnapshotFast<T>(colRef, onFresh);
  } catch (err) {
    console.error(`[firestore] loadFromFirestore(${collectionName}) ошибка:`, err);
    return [];
  }
};

const budgetPlanDocRef = (userId: string) => doc(firestoreDb!, colPath(COLLECTIONS.budgetPlan, userId), 'budget_plan');
const budgetPlanDocRefLegacy = (userId: string) => doc(firestoreDb!, COLLECTIONS.budgetPlan, `users/${userId}/budget_plan`);

export const loadBudgetPlan = async (
  userId?: string,
  onFresh?: (data: { items: unknown[]; updatedAt: string }) => void,
): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId || !firestoreDb) {
    return { items: [], updatedAt: '' };
  }
  try {
    const read = async (ref: ReturnType<typeof doc>) => {
      try {
        const cached = await getDocFromCache(ref);
        if (cached.exists()) {
          const data = cached.data() as { items?: unknown[]; updatedAt?: string };
          void withTimeout(getDocFromServer(ref), 4500, 'getDocFromServer')
            .then((snap) => {
              if (!snap.exists()) return;
              const fresh = snap.data() as { items?: unknown[]; updatedAt?: string };
              onFresh?.({ items: fresh.items ?? [], updatedAt: fresh.updatedAt ?? '' });
            })
            .catch(() => {});
          return { items: data.items ?? [], updatedAt: data.updatedAt ?? '' };
        }
      } catch {
        // cache miss
      }
      const snap = await withTimeout(getDocFromServer(ref), 4500, 'getDocFromServer');
      if (snap.exists()) {
        const data = snap.data() as { items?: unknown[]; updatedAt?: string };
        return { items: data.items ?? [], updatedAt: data.updatedAt ?? '' };
      }
      return null;
    };
    const primary = await read(budgetPlanDocRef(userId));
    if (primary) return primary;
    const legacy = await read(budgetPlanDocRefLegacy(userId));
    if (legacy) return legacy;
  } catch (err) {
    console.error('[firestore] loadBudgetPlan ошибка:', err);
  }
  return { items: [], updatedAt: '' };
};

export const saveBudgetPlan = async (userId?: string, items: unknown[] = [], updatedAt = new Date().toISOString()) => {
  if (!userId || !firestoreDb) return;
  try {
    await setDoc(budgetPlanDocRef(userId), {
      items,
      updatedAt,
      userId,
    });
  } catch (err) {
    console.error('[firestore] saveBudgetPlan ошибка:', err);
    throw err;
  }
};

export const resetBudgetPlan = async (userId?: string): Promise<{ items: unknown[]; updatedAt: string }> => {
  if (!userId || !firestoreDb) {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  try {
    await setDoc(budgetPlanDocRef(userId), {
      items: [],
      updatedAt: new Date().toISOString(),
      userId,
    });
  } catch (err) {
    console.error('[firestore] resetBudgetPlan ошибка:', err);
    throw err;
  }
  return { items: [], updatedAt: new Date().toISOString() };
};

export const syncPendingToFirestore = async (): Promise<void> => {
  if (!firestoreDb) return;
  const prefix = `denegnyj_put_`;
  const seen = new Set<string>();
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const matched = ALL_COLLECTIONS.find((c) => rest.endsWith(`_${c}`));
    if (!matched) continue;
    const userId = rest.slice(0, rest.length - matched.length - 1);
    if (!userId) continue;
    const seenKey = `${userId}:${matched}`;
    if (seen.has(seenKey)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;

      if (matched === COLLECTIONS.budgetPlan) {
        const plan = Array.isArray(parsed)
          ? { items: parsed, updatedAt: '' }
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
            ? { items: (parsed as { items: unknown[] }).items, updatedAt: String((parsed as { updatedAt?: unknown }).updatedAt ?? '') }
            : null;
        if (!plan || plan.items.length === 0) continue;
        await saveBudgetPlan(userId, plan.items, plan.updatedAt || new Date().toISOString());
        localStorage.removeItem(key);
        seen.add(seenKey);
        continue;
      }

      const items = Array.isArray(parsed)
        ? (parsed as { id: string }[])
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
          ? ((parsed as { items: { id: string }[] }).items)
          : [];
      if (items.length === 0) continue;
      await saveToFirestore(matched, items, userId);
      localStorage.removeItem(key);
      seen.add(seenKey);
    } catch (err) {
      console.error(`[firestore] syncPendingToFirestore(${matched}) ошибка:`, err);
    }
  }
};

export { firestoreDb, firebaseError };
