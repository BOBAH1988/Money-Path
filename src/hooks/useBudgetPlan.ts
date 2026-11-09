import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import type { BudgetPlanItem } from '../types';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
} from '../lib/budget';
import { deleteFromFirestore } from '../lib/firestore';
import { COLLECTIONS } from '../lib/dataStore';

export interface UseBudgetPlanReturn {
  items: BudgetPlanItem[];
  loading: boolean;
  error: string | null;
  addItem: (item: Omit<BudgetPlanItem, 'id'> | BudgetPlanItem) => void;
  updateItem: (id: string, patch: Partial<BudgetPlanItem>) => void;
  removeItem: (id: string) => void;
  reset: () => Promise<void>;
}

export function useBudgetPlan(): UseBudgetPlanReturn {
  const { isAuthReady, uid } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [items, setItems] = useState<BudgetPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = uid;

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);

    if (!userId) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await loadBudgetPlan(userId);
        setItems(data.items);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки плана');
        setIsLoading(false);
      }
    })();
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !userId) return;
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await saveBudgetPlan({ items, updatedAt: new Date().toISOString() }, userId);
        } catch (err) {
          toastError('Ошибка сохранения', err instanceof Error ? err.message : 'Не удалось сохранить данные');
        }
      })();
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [items, isAuthReady, userId, toastError]);

  const addItem = useCallback((item: Omit<BudgetPlanItem, 'id'> | BudgetPlanItem) => {
    const newItem = ('id' in item && item.id) ? (item as BudgetPlanItem) : { ...item, id: crypto.randomUUID() } as BudgetPlanItem;
    setItems((prev) => [...prev, newItem]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BudgetPlanItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (!userId) return;
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
      const def = await resetBudgetPlan(false, userId);
      setItems(def.items);
      toastSuccess('Данные очищены');
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
    }
  }, [toastError, toastSuccess]);

  const loading = !isAuthReady || isLoading;

  return { items, loading, error, addItem, updateItem, removeItem, reset };
}
