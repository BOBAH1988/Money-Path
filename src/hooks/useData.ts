import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useAuth } from '../context/AuthContext';
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
  type FirestoreCollection,
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
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      setLoadedFor(null);
      return;
    }
    if (!userId) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      setLoadedFor('__none__');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    dirtyRef.current = false;
    void (async () => {
      try {
        const data = await loadFromFirestore<T>(collectionName!, userId, (fresh) => {
          if (!cancelled && !dirtyRef.current) setItems(fresh);
        });
        if (!cancelled) {
          if (!dirtyRef.current) setItems(data);
          setLoadedFor(`${userId}:${collectionName}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
          setLoadedFor(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId, collectionName]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !userId || items.length === 0) return;
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await saveToFirestore<T>(collectionName!, items, userId);
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
      void (async () => {
        try {
          await deleteFromFirestore(collectionName!, id, userId);
        } catch {
          // ignore
        }
      })();
    },
    [collectionName, userId],
  );

  const loading = !isAuthReady || isLoading || (!!userId && loadedFor !== `${userId}:${collectionName}`);

  return { items, loading, error, addItem, updateItem, removeItem };
}