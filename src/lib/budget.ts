import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import {
  loadBudgetPlan as loadCloudBudgetPlan,
  syncPendingToFirestore,
} from './firestore';
import {
  enqueueBudgetPlan,
  getPendingBudgetPlan,
  loadLocalBudgetPlan,
  saveLocalBudgetPlan,
} from './dataStore';

const now = () => new Date().toISOString();

const emptyBudgetPlan: BudgetPlan = {
  updatedAt: now(),
  items: [],
};

const migrateItems = (items: unknown[]): BudgetPlanItem[] =>
  (Array.isArray(items) ? items : []).map((it) => {
    const item = (it ?? {}) as Partial<BudgetPlanItem> & Record<string, unknown>;
    return {
      ...item,
      plan: typeof item.plan === 'number' ? item.plan : typeof item.amount === 'number' ? item.amount : 0,
      amount: typeof item.amount === 'number' ? item.amount : 0,
    } as BudgetPlanItem;
  });

export const loadBudgetPlan = async (
  userId?: string,
  onFresh?: (plan: BudgetPlan) => void,
): Promise<BudgetPlan> => {
  const local = loadLocalBudgetPlan(userId);
  if (!userId) {
    return local
      ? { updatedAt: local.updatedAt || now(), items: migrateItems(local.items) }
      : emptyBudgetPlan;
  }
  if (getPendingBudgetPlan(userId)) await syncPendingToFirestore(userId);
  const cloudPlan = await loadCloudBudgetPlan(userId, (fresh) => {
    const plan = { updatedAt: fresh.updatedAt || now(), items: migrateItems(fresh.items) };
    saveLocalBudgetPlan(plan.items, userId, plan.updatedAt);
    onFresh?.(plan);
  });
  const result = { updatedAt: cloudPlan.updatedAt || now(), items: migrateItems(cloudPlan.items) };
  saveLocalBudgetPlan(result.items, userId, result.updatedAt);
  return result;
};

export const saveBudgetPlan = async (plan: BudgetPlan, userId?: string): Promise<void> => {
  const normalized: BudgetPlan = { updatedAt: plan.updatedAt || now(), items: migrateItems(plan.items ?? []) };
  saveLocalBudgetPlan(normalized.items, userId, normalized.updatedAt);
  if (!userId) return;
  enqueueBudgetPlan(userId, normalized.items, normalized.updatedAt);
  await syncPendingToFirestore(userId);
};

export const resetBudgetPlan = async (_empty = false, userId?: string): Promise<BudgetPlan> => {
  const reset = { updatedAt: now(), items: [] as BudgetPlanItem[] };
  await saveBudgetPlan(reset, userId);
  return reset;
};

export interface BudgetPageTotals {
  totalMonthly: number;
  totalPlanned: number;
  totalAll: number;
  totalMonthlyPlan: number;
  totalPlannedPlan: number;
  regularTotal: number;
}

export const safeNegate = (value: number): number => (-value) || 0;

export const computeTotals = (items: BudgetPlanItem[]): Record<BudgetGroup, number> => {
  const totals: Record<BudgetGroup, number> = { monthly: 0, planned: 0 };
  items.forEach((it) => {
    if (it.type === 'item') {
      totals[it.group] += it.amount;
    }
  });
  return totals;
};

export const computeBudgetPageTotals = (items: BudgetPlanItem[]): BudgetPageTotals => {
  const monthlyItems = items.filter((it) => it.group === 'monthly' && it.type === 'item');
  const plannedItems = items.filter((it) => it.group === 'planned' && it.type === 'item');
  const totalMonthly = monthlyItems.reduce((sum, it) => sum + (it.amount ?? 0), 0);
  const totalPlanned = plannedItems.reduce((sum, it) => sum + (it.amount ?? 0), 0);
  const totalMonthlyPlan = monthlyItems.reduce((sum, it) => sum + (it.plan ?? 0), 0);
  const totalPlannedPlan = plannedItems.reduce((sum, it) => sum + (it.plan ?? 0), 0);
  return {
    totalMonthly,
    totalPlanned,
    totalAll: totalMonthly + totalPlanned,
    totalMonthlyPlan,
    totalPlannedPlan,
    regularTotal: totalMonthlyPlan - totalPlannedPlan,
  };
};

export const applyComputedFields = (items: BudgetPlanItem[]): BudgetPlan => {
  const totals = computeTotals(items);
  const updatedItems = items.map((it) => {
    if (it.type === 'subtotal' && it.linkedGroup) {
      const linkedPlan = items
        .filter((i) => i.group === it.linkedGroup && i.type === 'item')
        .reduce((sum, i) => sum + i.plan, 0);
      return { ...it, amount: totals[it.linkedGroup], plan: linkedPlan };
    }
    if (it.type === 'total') {
      const ownAmount = items
        .filter((i) => i.group === it.group && i.type === 'item')
        .reduce((sum, i) => sum + i.amount, 0);
      const ownPlan = items
        .filter((i) => i.group === it.group && i.type === 'item')
        .reduce((sum, i) => sum + i.plan, 0);
      const subtotal = items.find(
        (i) => i.group === it.group && i.type === 'subtotal'
      );
      return {
        ...it,
        amount: ownAmount + (subtotal?.amount ?? 0),
        plan: ownPlan + (subtotal?.plan ?? 0),
      };
    }
    return it;
  });
  return { items: updatedItems, updatedAt: new Date().toISOString() };
};
