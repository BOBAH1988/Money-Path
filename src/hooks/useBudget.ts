import { useMemo } from 'react';
import { computeBudgetPageTotals, safeNegate } from '../lib/budget';
import { useBudgetPlan } from './useBudgetPlan';

export const useBudget = () => {
  const { items, loading, error, addItem, updateItem, removeItem, reset } = useBudgetPlan();
  const totals = useMemo(() => computeBudgetPageTotals(items as never), [items]);
  return {
    items,
    loading,
    error,
    totals,
    updateItem,
    addItem,
    removeItem,
    reset,
    groupTotal: () => 0,
  };
};
