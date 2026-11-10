import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import type { BudgetPlanItem } from '../types';
import { loadBudgetPlan, resetBudgetPlan, saveBudgetPlan } from '../lib/budget';
import { loadLocalBudgetPlan } from '../lib/dataStore';

export interface UseBudgetPlanReturn {
  items: BudgetPlanItem[];
  loading: boolean;
  error: string | null;
  addItem: (item: Omit<BudgetPlanItem, 'id'> | BudgetPlanItem) => void;
  updateItem: (id: string, patch: Partial<BudgetPlanItem>) => void;
  removeItem: (id: string) => void;
  reset: (notify?: boolean) => Promise<void>;
}

export function useBudgetPlan(): UseBudgetPlanReturn {
  const { isAuthReady, uid } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const [items, setItems] = useState<BudgetPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<BudgetPlanItem[]>([]);
  const revisionRef = useRef(0);

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }

    let cancelled = false;
    const local = loadLocalBudgetPlan(uid);
    const localItems = (local?.items ?? []) as BudgetPlanItem[];
    const revision = revisionRef.current;
    itemsRef.current = localItems;
    setItems(localItems);
    setIsLoading(false);
    setError(null);

    if (!uid) return () => { cancelled = true; };

    void loadBudgetPlan(uid, (plan) => {
      if (cancelled || revisionRef.current !== revision) return;
      itemsRef.current = plan.items;
      setItems(plan.items);
    }).then((plan) => {
      if (cancelled || revisionRef.current !== revision) return;
      const fresh = plan.items;
      itemsRef.current = fresh;
      setItems(fresh);
    }).catch((err) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : 'Ошибка загрузки плана';
      setError(message);
      toastError('Ошибка синхронизации', message);
    });

    return () => { cancelled = true; };
  }, [isAuthReady, uid, toastError]);

  useEffect(() => {
    if (!isAuthReady || !uid) return;
    const refreshWhenOnline = () => {
      if (document.visibilityState === 'hidden') return;
      const revision = revisionRef.current;
      void loadBudgetPlan(uid, (plan) => {
        if (revisionRef.current !== revision) return;
        itemsRef.current = plan.items;
        setItems(plan.items);
      }).then((plan) => {
        if (revisionRef.current !== revision) return;
        itemsRef.current = plan.items;
        setItems(plan.items);
        setError(null);
      }).catch((err) => {
        const message = err instanceof Error ? err.message : 'Ошибка синхронизации плана';
        setError(message);
        toastError('Ошибка синхронизации', message);
      });
    };
    window.addEventListener('online', refreshWhenOnline);
    window.addEventListener('focus', refreshWhenOnline);
    document.addEventListener('visibilitychange', refreshWhenOnline);
    return () => {
      window.removeEventListener('online', refreshWhenOnline);
      window.removeEventListener('focus', refreshWhenOnline);
      document.removeEventListener('visibilitychange', refreshWhenOnline);
    };
  }, [isAuthReady, toastError, uid]);

  const persist = useCallback((next: BudgetPlanItem[]) => {
    itemsRef.current = next;
    revisionRef.current += 1;
    setItems(next);
    setError(null);
    void saveBudgetPlan({ items: next, updatedAt: new Date().toISOString() }, uid).catch((err) => {
      const message = err instanceof Error ? err.message : 'Изменения сохранены на устройстве';
      setError(message);
      toastError(
        'Синхронизация ожидает подключения',
        message,
      );
    });
  }, [toastError, uid]);

  const addItem = useCallback((item: Omit<BudgetPlanItem, 'id'> | BudgetPlanItem) => {
    const newItem: BudgetPlanItem = 'id' in item && item.id
      ? item as BudgetPlanItem
      : { ...item, id: crypto.randomUUID() } as BudgetPlanItem;
    persist([...itemsRef.current, newItem]);
  }, [persist]);

  const updateItem = useCallback((id: string, patch: Partial<BudgetPlanItem>) => {
    persist(itemsRef.current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, [persist]);

  const removeItem = useCallback((id: string) => {
    persist(itemsRef.current.filter((item) => item.id !== id));
  }, [persist]);

  const reset = useCallback(async (notify = true) => {
    const emptyItems: BudgetPlanItem[] = [];
    itemsRef.current = emptyItems;
    revisionRef.current += 1;
    setItems(emptyItems);
    try {
      const plan = await resetBudgetPlan(false, uid);
      itemsRef.current = plan.items;
      if (notify) toastSuccess('Данные очищены');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось синхронизировать сброс';
      setError(message);
      if (notify) {
        toastError('Сброс сохранён на устройстве', `${message}. Повторная синхронизация выполнится при подключении.`);
      }
    }
  }, [toastError, toastSuccess, uid]);

  return { items, loading: !isAuthReady || isLoading, error, addItem, updateItem, removeItem, reset };
}
