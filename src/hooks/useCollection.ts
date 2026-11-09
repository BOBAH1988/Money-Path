import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { firestoreDb } from '../lib/firebase';
import {
  loadLocalCollection,
  loadFromFirestore,
  saveToFirestore,
  COLLECTIONS,
  colPath,
  type FirestoreCollection,
} from '../lib/firestore';
import { collection, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';

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
  const toastWarningRef = useRef(toastWarning);

  useEffect(() => {
    toastWarningRef.current = toastWarning;
  }, [toastWarning]);
  const [items, setItems] = useState<T[]>(() => loadLocalCollection<T>(collectionName, userId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firestoreOffline, setFirestoreOffline] = useState(false);
  const isLoadedRef = useRef(false);
  const offlineWarnedRef = useRef(false);

  // Загружаем из localStorage синхронно — сразу показываем данные, без ожидания Firebase
  useEffect(() => {
    const localData = loadLocalCollection<T>(collectionName, userId);
    if (localData.length > 0) {
      setItems(localData);
    }
    setLoading(false);
    isLoadedRef.current = true;

    // Фоновая синхронизация с Firestore — не блокирует UI
    if (userId && firestoreDb) {
      void (async () => {
        try {
          const data = await loadFromFirestore<T>(collectionName, userId);
          if (data.length > 0) {
            setItems(data);
          }
        } catch {
          setFirestoreOffline(true);
          if (!offlineWarnedRef.current) {
            toastWarningRef.current(
              'База данных недоступна',
              'Данные хранятся локально и синхронизируются при восстановлении связи'
            );
            offlineWarnedRef.current = true;
          }
        }
      })();
    }
  }, [collectionName, userId]);

  // При входе в аккаунт (смена userId) — принудительно загружаем данные из Firestore
  // и перезаписываем localStorage, чтобы данные появились на новом устройстве.
  // loadFromFirestore имеет приоритет localStorage, поэтому грузим напрямую.
  useEffect(() => {
    if (!userId || !firestoreDb || !isLoadedRef.current) return;

    void (async () => {
      try {
        const colRef = collection(firestoreDb, colPath(collectionName, userId));
        const q = query(colRef, orderBy('id'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(
          (docSnap) => docSnap.data() as unknown as T
        );
        if (data.length > 0) {
          saveToFirestore(collectionName, data, userId).catch(() => {});
          setItems(data);
        }
      } catch {
        // Firestore недоступен — оставляем локальные данные
      }
    });
  }, [collectionName, userId]);

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
      let isEmpty = false;
      setItems((prev) => {
        const filtered = prev.filter((it) => it.id !== id);
        isEmpty = filtered.length === 0;
        try {
          const now = new Date().toISOString();
          const stamped = filtered.map((item) => ({ ...item, updatedAt: now }));
          const key = userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;
          if (isEmpty) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(stamped));
          }
        } catch {}
        return filtered;
      });
      // Когда удалена последняя строка — прямо очищаем Firestore, чтобы данные не вернулись
      if (isEmpty && userId && firestoreDb) {
        void (async () => {
          try {
            const colRef = collection(firestoreDb, `users/${userId}/${collectionName}`);
            const snapshot = await getDocs(colRef);
            await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
          } catch {}
        })();
      }
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
