import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useAuth } from '../context/AuthContext';
import {
  loadLocalCollection,
  saveLocalCollection,
  type FirestoreCollection,
} from '../lib/dataStore';
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const localOnly = !collectionName;

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    dirtyRef.current = false;

    if (localOnly) {
      const local = loadLocalCollection<T>('__local__', userId);
      if (!cancelled) {
        setItems(local);
        setIsLoading(false);
      }
      return () => { cancelled = true; };
    }

    const local = loadLocalCollection<T>(collectionName!, userId);
    setItems(local);
    setIsLoading(false);

    if (!userId) return () => { cancelled = true; };

    void (async () => {
      try {
        const data = await loadFromFirestore<T>(collectionName!, userId, (fresh) => {
          if (cancelled || dirtyRef.current) return;
          setItems(fresh);
          saveLocalCollection(collectionName!, fresh, userId);
        });
        if (!cancelled && !dirtyRef.current) {
          setItems(data);
          saveLocalCollection(collectionName!, data, userId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId, collectionName, localOnly]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !collectionName) return;
    saveLocalCollection(collectionName, items, userId);
    if (!userId) return;
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await saveToFirestore<T>(collectionName, items, userId);
        } catch (err) {
          toastError('Ошибка сохранения', err instanceof Error ? err.message : 'Не удалось сохранить данные');
        }
      })();
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, isAuthReady, userId, collectionName, toastError]);

  const addItem = useCallback(
    (item: Omit<T, 'id'>) => {
      dirtyRef.current = true;
      const newItem: T = { ...item, id: crypto.randomUUID() } as T;
      setItems((prev) => [...prev, newItem]);
    },
    [],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      dirtyRef.current = true;
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const removeItem = useCallback(
    (id: string) => {
      dirtyRef.current = true;
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (!userId || !collectionName) return;
      void (async () => {
        try {
          await deleteFromFirestore(collectionName, id, userId);
        } catch {
          // ignore
        }
      })();
    },
    [collectionName, userId],
  );

  return { items, loading: !isAuthReady || isLoading, error, addItem, updateItem, removeItem };
}
