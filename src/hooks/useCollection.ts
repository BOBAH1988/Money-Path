import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { firestoreDb } from '../lib/firebase';
import {
  loadFromFirestore,
  saveToFirestore,
  COLLECTIONS,
  type FirestoreCollection,
} from '../lib/firestore';

interface UseCollectionOptions {
  collectionName: FirestoreCollection;
  userId?: string;
}

interface UseCollectionReturn<T extends { id: string }> {
  items: T[];
  loading: boolean;
  error: string | null;
  firestoreOffline: boolean;
  addItem: (item: Omit<T, 'id'>) => void;
  updateItem: (id: string, patch: Partial<T>) => void;
  removeItem: (id: string) => void;
}

export function useCollection<T extends { id: string }>(
  options: UseCollectionOptions
): UseCollectionReturn<T> {
  const { collectionName, userId } = options;
  const { error: toastError, warning: toastWarning } = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firestoreOffline, setFirestoreOffline] = useState(false);
  const isLoadedRef = useRef(false);
  const offlineWarnedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await loadFromFirestore<T>(collectionName, userId);
        setItems(data);
        if (!firestoreDb) {
          setFirestoreOffline(true);
          if (!offlineWarnedRef.current) {
            toastWarning('База данных недоступна', 'Данные хранятся локально и синхронизируются при восстановлении связи');
            offlineWarnedRef.current = true;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных';
        setError(msg);
        setFirestoreOffline(true);
        if (!offlineWarnedRef.current) {
          toastWarning('База данных недоступна', 'Данные хранятся локально и синхронизируются при восстановлении связи');
          offlineWarnedRef.current = true;
        }
      } finally {
        setLoading(false);
        isLoadedRef.current = true;
      }
    };
    load();
  }, [collectionName, userId, toastError, toastWarning]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveToFirestore(collectionName, items, userId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения';
      setError(msg);
      setFirestoreOffline(true);
      if (!offlineWarnedRef.current) {
        toastWarning('База данных недоступна', 'Данные сохранены локально и синхронизируются при восстановлении связи');
        offlineWarnedRef.current = true;
      }
      toastError('Ошибка сохранения', msg);
    });
  }, [items, collectionName, userId, toastError, toastWarning]);

  const addItem = useCallback(
    (item: Omit<T, 'id'>) => {
      const newItem = { ...item, id: crypto.randomUUID() } as T;
      setItems((prev) => [...prev, newItem]);
    },
    []
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
      );
    },
    []
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const filtered = prev.filter((it) => it.id !== id);
        try {
          const now = new Date().toISOString();
          const stamped = filtered.map((item) => ({ ...item, updatedAt: now }));
          const key = userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;
          if (filtered.length > 0) {
            localStorage.setItem(key, JSON.stringify(stamped));
          } else {
            localStorage.removeItem(key);
          }
        } catch {}
        // Всегда синхронизируем с Firestore — пустой массив очистит облако, и строка не вернётся
        saveToFirestore(collectionName, filtered, userId).catch(() => {});
        return filtered;
      });
    },
    [collectionName, userId]
  );

  return {
    items,
    loading,
    error,
    firestoreOffline,
    addItem,
    updateItem,
    removeItem,
  };
}

export { COLLECTIONS };
