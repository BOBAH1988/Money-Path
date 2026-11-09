import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import type { BudgetPlanItem } from '../types';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  deleteFromFirestore,
  COLLECTIONS,
} from '../lib/firestore';

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
  const [plan, setPlan] = useState<{ items: BudgetPlanItem[]; updatedAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = uid;

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      setLoadedFor(null);
      return;
    }
    if (!userId) {
      setPlan(null);
      setError(null);
      setIsLoading(false);
      setLoadedFor('__none__');
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await loadBudgetPlan(userId, (fresh) => {
          if (!cancelled) setPlan({ items: (fresh.items ?? []) as BudgetPlanItem[], updatedAt: fresh.updatedAt ?? '' });
        });
        if (!cancelled) {
          setPlan({ items: (data.items ?? []) as BudgetPlanItem[], updatedAt: data.updatedAt ?? '' });
          setLoadedFor(userId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки плана');
          setLoadedFor(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !userId || !plan) return;
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

  const addItem = useCallback((item: Omit<BudgetPlanItem, 'id'> | BudgetPlanItem) => {
    const newItem = ('id' in item && item.id) ? (item as BudgetPlanItem) : { ...item, id: crypto.randomUUID() } as BudgetPlanItem;
    setPlan((prev) => {
      const nextItems = prev?.items ? [...prev.items, newItem] : [newItem];
      return { items: nextItems, updatedAt: new Date().toISOString() };
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BudgetPlanItem>) => {
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
      setPlan({ items: (def.items ?? []) as BudgetPlanItem[], updatedAt: def.updatedAt ?? new Date().toISOString() });
      toastSuccess('Данные очищены');
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
    }
  }, [userId, toastError, toastSuccess]);

  const loading = !isAuthReady || isLoading || (!!userId && loadedFor !== userId);

  return { items: plan?.items ?? [], loading, error, addItem, updateItem, removeItem, reset };
}
