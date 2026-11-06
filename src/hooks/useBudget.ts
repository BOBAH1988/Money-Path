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

  // Загрузка плана из Firestore при монтировании
  useEffect(() => {
    const load = async () => {
      const p = await loadBudgetPlan();
      setPlan(p);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !plan) {
    return {
      items: [],
      updatedAt: '',
      updateItem: () => {},
      addItem: () => {},
      removeItem: () => {},
      reset: () => {},
      groupTotal: () => 0,
    };
  }

  // Вычисляемые поля (суммы итогов и запланированных расходов) пересчитываются при рендере
  const computed = useMemo(() => applyComputedFields(plan.items), [plan.items]);

  // Сохранение в Firestore — внешняя синхронизация
  useEffect(() => {
    const prevItems = plan.items;
    const currentItems = computed.items;
    const current = JSON.stringify(currentItems);
    const previous = JSON.stringify(prevItems);
    if (current !== previous) {
      saveBudgetPlan(computed);
    }
  }, [computed, plan.items]);

  const persist = useCallback((updated: BudgetPlan) => {
    setPlan(updated);
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<BudgetPlanItem, 'name' | 'amount' | 'plan'>>) => {
      persist({
        ...plan,
        items: plan.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      });
    },
    [plan, persist]
  );

  const addItem = useCallback(
    (group: BudgetGroup, name = 'Новая строка', amount = 0, planAmount = amount) => {
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
      persist({
        ...plan,
        items: plan.items.filter((it) => it.id !== id),
      });
    },
    [plan, persist]
  );

  const reset = useCallback(async (empty = false) => {
    const def = await resetBudgetPlan(empty);
    setPlan(def);
  }, []);

  const groupTotal = useCallback(
    (group: BudgetGroup) => {
      if (group === 'monthly') {
        return plan.items
          .filter((it) => it.type === 'item')
          .reduce((sum, it) => sum + it.amount, 0);
      }
      return plan.items
        .filter((it) => it.group === 'planned' && it.type === 'item')
        .reduce((sum, it) => sum + it.amount, 0);
    },
    [plan.items]
  );

  return {
    items: computed.items,
    updatedAt: computed.updatedAt,
    updateItem,
    addItem,
    removeItem,
    reset,
    groupTotal,
  };
};
