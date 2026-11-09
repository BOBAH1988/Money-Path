import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import type { BudgetPlanItem } from '../types';
import { loadLocalBudgetPlan, saveLocalBudgetPlan, COLLECTIONS } from '../lib/dataStore';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  deleteFromFirestore,
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

const toItems = (value: unknown): BudgetPlanItem[] => (Array.isArray(value) ? (value as BudgetPlanItem[]) : []);

export function useBudgetPlan(): UseBudgetPlanReturn {
  const { isAuthReady, uid } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [plan, setPlan] = useState<{ items: BudgetPlanItem[]; updatedAt: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLoadedFor] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const remoteLoadedRef = useRef(false);
  const userId = uid;

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    dirtyRef.current = false;
    remoteLoadedRef.current = false;
    const local = loadLocalBudgetPlan(userId);
    const hasLocal = toItems(local.items).length > 0;
    setPlan({ items: toItems(local.items), updatedAt: local.updatedAt ?? '' });
    setIsLoading(false);
    setLoadedFor(userId ?? '__guest__');

    if (!userId) return () => { cancelled = true; };

    void (async () => {
      try {
        const data = await loadBudgetPlan(userId, (fresh) => {
          if (cancelled || dirtyRef.current) return;
          remoteLoadedRef.current = true;
          const nextItems = toItems(fresh.items);
          const next = { items: nextItems, updatedAt: fresh.updatedAt ?? '' };
          // Не затирать непустой локальный план пустым/устаревшим ответом сервера.
          if (nextItems.length === 0 && hasLocal) return;
          setPlan(next);
          saveLocalBudgetPlan(next.items, next.updatedAt, userId);
        });
        if (cancelled || dirtyRef.current) return;
        remoteLoadedRef.current = true;
        const nextItems = toItems(data.items);
        if (nextItems.length === 0 && hasLocal) return;
        const next = { items: nextItems, updatedAt: data.updatedAt ?? '' };
        setPlan(next);
        saveLocalBudgetPlan(next.items, next.updatedAt, userId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки плана');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isAuthReady || !plan) return;
    const updatedAt = plan.updatedAt || new Date().toISOString();
    saveLocalBudgetPlan(plan.items, updatedAt, userId);
    if (!userId) return;
    // Не отправлять пустой план на сервер, пока удалённый план ещё не загружен:
    // это защищает от затирания данных при гонках/ошибках сети.
    if (plan.items.length === 0 && !remoteLoadedRef.current && !dirtyRef.current) return;
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await saveBudgetPlan(userId, plan.items, updatedAt);
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
    dirtyRef.current = true;
    const newItem = ('id' in item && item.id) ? (item as BudgetPlanItem) : { ...item, id: crypto.randomUUID() } as BudgetPlanItem;
    setPlan((prev) => {
      const nextItems = prev?.items ? [...prev.items, newItem] : [newItem];
      return { items: nextItems, updatedAt: new Date().toISOString() };
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BudgetPlanItem>) => {
    dirtyRef.current = true;
    setPlan((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
      return { items: nextItems, updatedAt: new Date().toISOString() };
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    dirtyRef.current = true;
    setPlan((prev) => {
      if (!prev) return prev;
      return { items: prev.items.filter((it) => it.id !== id), updatedAt: new Date().toISOString() };
    });
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
      if (userId) {
        const def = await resetBudgetPlan(userId);
        dirtyRef.current = false;
        remoteLoadedRef.current = true;
        const next = { items: toItems(def.items), updatedAt: def.updatedAt ?? new Date().toISOString() };
        setPlan(next);
        saveLocalBudgetPlan(next.items, next.updatedAt, userId);
      } else {
        dirtyRef.current = false;
        remoteLoadedRef.current = true;
        const next = { items: [] as BudgetPlanItem[], updatedAt: new Date().toISOString() };
        setPlan(next);
        saveLocalBudgetPlan(next.items, next.updatedAt, userId);
      }
      toastSuccess('Данные очищены');
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
    }
  }, [userId, toastError, toastSuccess]);

  const loading = !isAuthReady || (isLoading && !plan);

  return { items: plan?.items ?? [], loading, error, addItem, updateItem, removeItem, reset };
}
