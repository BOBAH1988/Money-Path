import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import {
  loadBudgetPlan,
  saveBudgetPlan,
  resetBudgetPlan,
  applyComputedFields,
} from '../lib/budget';

export const useBudget = () => {
  const [plan, setPlan] = useState<BudgetPlan>(() => loadBudgetPlan());

  // Вычисляемые поля (суммы итогов и запланированных расходов) пересчитываются при рендере
  const computed = useMemo(() => applyComputedFields(plan.items), [plan.items]);

  // Сохранение в локальное хранилище — внешняя синхронизация
  useEffect(() => {
    saveBudgetPlan(computed);
  }, [computed]);

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

  const reset = useCallback(() => {
    const def = resetBudgetPlan();
    setPlan(def);
  }, []);

  const groupTotal = useCallback(
    (group: BudgetGroup) => {
      return computed.items
        .filter((it) => it.group === group && it.type === 'total')
        .reduce((sum, it) => sum + it.amount, 0);
    },
    [computed]
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