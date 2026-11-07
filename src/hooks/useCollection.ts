import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
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
  addItem: (item: Omit<T, 'id'>) => void;
  updateItem: (id: string, patch: Partial<T>) => void;
  removeItem: (id: string) => void;
}

export function useCollection<T extends { id: string }>(
  options: UseCollectionOptions
): UseCollectionReturn<T> {
  const { collectionName, userId } = options;
  const { error: toastError } = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await loadFromFirestore<T>(collectionName, userId);
        setItems(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных';
        setError(msg);
        toastError('Ошибка загрузки', msg);
      } finally {
        setLoading(false);
        isLoadedRef.current = true;
      }
    };
    load();
  }, [collectionName, userId, toastError]);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    saveToFirestore(collectionName, items, userId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения';
      setError(msg);
      toastError('Ошибка сохранения', msg);
    });
  }, [items, collectionName, userId, toastError]);

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
        if (prev.length <= 1) {
          // Вместо удаления последней строки — очищаем её значения
          return prev.map((it) =>
            it.id === id ? ({ ...it, name: '' } as T) : it
          );
        }
        return prev.filter((it) => it.id !== id);
      });
    },
    []
  );

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
  };
}

export { COLLECTIONS };
