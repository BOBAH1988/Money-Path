import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  applyComputedFields,
} from '../lib/budget';

export const useBudget = () => {
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await loadBudgetPlan();
        setPlan(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const computed = useMemo(() => {
    if (!plan) return { items: [], updatedAt: '' };
    return applyComputedFields(plan.items);
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const prevItems = plan.items;
    const currentItems = computed.items;
    const current = JSON.stringify(currentItems);
    const previous = JSON.stringify(prevItems);
    if (current !== previous) {
      saveBudgetPlan(computed).catch((err) => {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      });
    }
  }, [computed, plan]);

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
      const def = await resetBudgetPlan(empty);
      setPlan(def);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сброса');
    }
  }, []);

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
