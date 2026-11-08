import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import { firestoreDb } from '../lib/firebase';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  applyComputedFields,
} from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';

export const useBudget = () => {
  const { uid } = useAuth();
  const { toast: addToast, warning: addWarning } = useToast();
  const userId = uid;
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);
  const offlineWarnedRef = useRef(false);
  useEffect(() => {
    const load = async () => {
      try {
        const p = await loadBudgetPlan(userId);
        setPlan(p);
        if (!firestoreDb && !offlineWarnedRef.current) {
          addWarning('База данных недоступна', 'Данные хранятся локально и синхронизируются при восстановлении связи');
          offlineWarnedRef.current = true;
        }
      } catch (err) {
        if (!offlineWarnedRef.current) {
          addWarning('База данных недоступна', 'Данные хранятся локально и синхронизируются при восстановлении связи');
          offlineWarnedRef.current = true;
        }
        addToast('error', 'Ошибка загрузки', err instanceof Error ? err.message : 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, addToast, addWarning]);

  const computed = useMemo(() => {
    if (!plan) return { items: [], updatedAt: '' };
    return applyComputedFields(plan.items);
  }, [plan]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!plan) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBudgetPlan(computed, userId).catch((err) => {
        if (!offlineWarnedRef.current) {
          addWarning('База данных недоступна', 'Данные сохранены локально и синхронизируются при восстановлении связи');
          offlineWarnedRef.current = true;
        }
        addToast('error', 'Ошибка сохранения', err instanceof Error ? err.message : 'Не удалось сохранить данные');
      });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [computed, plan, userId, addToast, addWarning]);

  const persist = useCallback((updated: BudgetPlan) => {
    setPlan(updated);
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<BudgetPlanItem, 'name' | 'amount' | 'plan'>>) => {
      if (!plan) return;
      persist({
        ...plan,
        items: plan.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      });
    },
    [plan, persist]
  );

  const addItem = useCallback(
    (group: BudgetGroup, name = 'Новая строка', amount = 0, planAmount = amount) => {
      if (!plan) return;
      const item: BudgetPlanItem = {
        id: crypto.randomUUID(),
        name,
        amount,
        plan: planAmount,
        group,
        type: 'item',
      };
      persist({
        ...plan,
        items: [...plan.items, item],
      });
    },
    [plan, persist]
  );

  const removeItem = useCallback(
    (id: string) => {
      if (!plan) return;
      persist({
        ...plan,
        items: plan.items.filter((it) => it.id !== id),
      });
    },
    [plan, persist]
  );

  const reset = useCallback(async (empty = false) => {
    try {
      const def = await resetBudgetPlan(empty, userId);
      setPlan(def);
    } catch (err) {
      addToast('error', 'Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
    }
  }, [userId, addToast]);

  const groupTotal = useCallback(
    (group: BudgetGroup) => {
      if (!plan) return 0;
      if (group === 'monthly') {
        return plan.items
          .filter((it) => it.type === 'item')
          .reduce((sum, it) => sum + it.amount, 0);
      }
      return plan.items
        .filter((it) => it.group === 'planned' && it.type === 'item')
        .reduce((sum, it) => sum + it.amount, 0);
    },
    [plan]
  );

  if (loading || !plan) {
    return {
      items: [],
      updatedAt: '',
      loading,
      error,
      updateItem,
      addItem,
      removeItem,
      reset,
      groupTotal,
    };
  }

  return {
    items: computed.items,
    updatedAt: computed.updatedAt,
    loading,
    error,
    updateItem,
    addItem,
    removeItem,
    reset,
    groupTotal,
  };
};
