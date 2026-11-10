import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useAuth } from '../context/AuthContext';
import {
  loadLocalCollection,
  saveLocalCollection,
  enqueueCollectionUpsert,
  enqueueCollectionDelete,
  getPendingCollectionOperations,
  type FirestoreCollection,
} from '../lib/dataStore';
import {
  loadFromFirestore,
  syncPendingToFirestore,
} from '../lib/firestore';

export interface UseDataOptions {
  collectionName?: FirestoreCollection;
  userId?: string;
}

export interface UseDataReturn<T extends { id: string }> {
  items: T[];
  loading: boolean;
  error: string | null;
  addItem: (item: Omit<T, 'id'>) => void;
  updateItem: (id: string, patch: Partial<T>) => void;
  removeItem: (id: string) => void;
}

export function useData<T extends { id: string }>(options: UseDataOptions): UseDataReturn<T> {
  const { collectionName, userId } = options;
  const { error: toastError } = useToast();
  const { isAuthReady } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const itemsRef = useRef<T[]>([]);
  const mutationVersionRef = useRef(0);
  const localOnly = !collectionName;
  const localCollectionName = collectionName ?? '__local__';

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    if (localOnly) {
      const local = loadLocalCollection<T>('__local__', userId);
      if (!cancelled) {
        dirtyRef.current = false;
        itemsRef.current = local;
        setItems(local);
        setIsLoading(false);
      }
      return () => { cancelled = true; };
    }

    const local = loadLocalCollection<T>(collectionName!, userId);
    const pending = userId ? getPendingCollectionOperations(collectionName!, userId).length > 0 : false;
    const initialMutationVersion = mutationVersionRef.current;
    dirtyRef.current = pending;
    itemsRef.current = local;
    setItems(local);
    setIsLoading(false);

    if (!userId) return () => { cancelled = true; };

    const refreshWhenOnline = () => {
      if (document.visibilityState === 'hidden') return;
      const version = mutationVersionRef.current;
      void syncPendingToFirestore(userId)
        .then(() => loadFromFirestore<T>(collectionName!, userId))
        .then((fresh) => {
          if (cancelled || mutationVersionRef.current !== version) return;
          dirtyRef.current = false;
          itemsRef.current = fresh;
          setItems(fresh);
          setError(null);
          saveLocalCollection(collectionName!, fresh, userId);
        })
        .catch((err) => {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : 'Ошибка синхронизации';
          setError(message);
          toastError('Ошибка синхронизации', message);
        });
    };
    window.addEventListener('online', refreshWhenOnline);
    window.addEventListener('focus', refreshWhenOnline);
    document.addEventListener('visibilitychange', refreshWhenOnline);

    void (async () => {
      try {
        if (pending) {
          await syncPendingToFirestore(userId);
          if (mutationVersionRef.current === initialMutationVersion) dirtyRef.current = false;
        }
        const data = await loadFromFirestore<T>(collectionName!, userId, (fresh) => {
          if (cancelled || dirtyRef.current) return;
          itemsRef.current = fresh;
          setItems(fresh);
          saveLocalCollection(collectionName!, fresh, userId);
        });
        if (!cancelled && !dirtyRef.current) {
          itemsRef.current = data;
          setItems(data);
          setError(null);
          saveLocalCollection(collectionName!, data, userId);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Ошибка загрузки данных';
          setError(message);
          toastError('Ошибка синхронизации', message);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.removeEventListener('online', refreshWhenOnline);
      window.removeEventListener('focus', refreshWhenOnline);
      document.removeEventListener('visibilitychange', refreshWhenOnline);
    };
  }, [isAuthReady, userId, collectionName, localOnly, toastError]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (itemsRef.current !== items) return;
    itemsRef.current = items;
    saveLocalCollection(localCollectionName, items, userId);
  }, [items, isAuthReady, userId, localCollectionName]);

  const persistMutation = useCallback((next: T[], kind: 'upsert' | 'delete', item?: T, itemId?: string) => {
    dirtyRef.current = true;
    itemsRef.current = next;
    mutationVersionRef.current += 1;
    saveLocalCollection(localCollectionName, next, userId);
    setItems(next);
    if (!collectionName || !userId) return;
    try {
      if (kind === 'upsert' && item) enqueueCollectionUpsert(collectionName, userId, item);
      if (kind === 'delete' && itemId) enqueueCollectionDelete(collectionName, userId, itemId);
    } catch (err) {
      toastError('Не удалось сохранить изменения', err instanceof Error ? err.message : 'Ошибка локального хранилища');
      return;
    }
    void syncPendingToFirestore(userId).catch((err) => {
      toastError('Синхронизация ожидает подключения', err instanceof Error ? err.message : 'Изменения сохранены на устройстве');
    });
  }, [collectionName, localCollectionName, toastError, userId]);

  const addItem = useCallback(
    (item: Omit<T, 'id'>) => {
      const newItem: T = { ...item, id: crypto.randomUUID() } as T;
      persistMutation([...itemsRef.current, newItem], 'upsert', newItem);
    },
    [persistMutation],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      const updated = { ...current, ...patch };
      persistMutation(itemsRef.current.map((item) => item.id === id ? updated : item), 'upsert', updated);
    },
    [persistMutation],
  );

  const removeItem = useCallback(
    (id: string) => {
      persistMutation(itemsRef.current.filter((item) => item.id !== id), 'delete', undefined, id);
    },
    [persistMutation],
  );

  return { items, loading: !isAuthReady || isLoading, error, addItem, updateItem, removeItem };
}
