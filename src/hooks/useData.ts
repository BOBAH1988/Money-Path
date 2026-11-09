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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthReady) {
      setLoading(true);
      return;
    }
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const data = await loadFromFirestore<T>(collectionName!, userId);
        setItems(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthReady, userId, collectionName]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !userId || items.length === 0) {
      setLoading(false);
      return;
    }
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
      const newItem: T = { ...item, id: crypto.randomUUID() } as T;
      setItems((prev) => [...prev, newItem]);
    },
    [],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const removeItem = useCallback(
    (id: string) => {
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

  return { items, loading, error, addItem, updateItem, removeItem };
}