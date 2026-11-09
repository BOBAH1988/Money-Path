import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { useAuth } from '../context/AuthContext';
import {
  saveToFirestore,
  loadFromFirestore,
  deleteFromFirestore,
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
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
  const { error: toastError, success: toastSuccess } = useToast();
  const { isAuthReady } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Первая загрузка — сразу при входе, без лишнего таймера.
  useEffect(() => {
    if (!isAuthReady || !userId) {
      setLoading(false);
      return;
    }
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

  // Сохранение: нет "consider the saved data", так как нет локального источника.
  // Используем декоратор, чтобы 3 раза в секунду не спамить setDoc squad.
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
      const newItem: T = { ...item, id: crypto.randomUUID() };
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

export interface UseBudgetPlanReturn {
  items: unknown[];
  loading: boolean;
  error: string | null;
  addItem: (item: Record<string, unknown>) => void;
  updateItem: (id: string, patch: Partial<Record<string, unknown>>) => void;
  removeItem: (id: string) => void;
  reset: () => Promise<void>;
}

export function useBudgetPlan(): UseBudgetPlanReturn {
  const { isAuthReady } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [plan, setPlan] = useState<{ items: unknown[]; updatedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useAuth().uid;

  useEffect(() => {
    if (!isAuthReady || !userId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const data = await loadBudgetPlan(userId);
        setPlan({ items: data.items ?? [], updatedAt: data.updatedAt ?? '' });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки плана');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !userId || !plan) {
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await saveBudgetPlan(userId, plan.items, plan.updatedAt);
        } catch (err) {
          toastError('Ошибка сохранения', err instanceof Error ? err.message : 'Не удалось сохранить данные');
        }
      })();
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plan, isAuthReady, userId, toastError]);

  const addItem = useCallback((item: Record<string, unknown>) => {
    setPlan((prev) => {
      const nextItems = prev?.items ? [...prev.items, item] : [item];
      return { items: nextItems, updatedAt: new Date().toISOString() };
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Record<string, unknown>>) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
      return { items: nextItems, updatedAt: new Date().toISOString() };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return { items: prev.items.filter((it) => it.id !== id), updatedAt: new Date().toISOString() };
    });
    void (async () => {
      try {
        await deleteFromFirestore(COLLECTIONS.budgetPlan, id, userId);
      } catch {
        // ignore
      }
    })();
  }, [userId]);

  const reset = useCallback(async () => {
    try {
      const def = await resetBudgetPlan(userId);
      setPlan({ items: def.items, updatedAt: def.updatedAt });
      toastSuccess('Данные очищены');
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
    }
  }, [userId, toastError, toastSuccess]);

  return { items: plan?.items ?? [], loading, error, addItem, updateItem, removeItem, reset };
}
