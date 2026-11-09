import { useMemo } from 'react';
import { computeBudgetPageTotals } from '../lib/budget';
import { useBudgetPlan } from './useBudgetPlan';

export const useBudget = () => {
  const { items, loading, error, addItem, updateItem, removeItem, reset } = useBudgetPlan();
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);
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
