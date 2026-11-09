import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  deleteFromFirestore,
  COLLECTIONS,
} from '../lib/firestore';

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
