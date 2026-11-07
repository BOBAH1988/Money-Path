import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import { firestoreDb as db, COLLECTIONS, isResetPending } from './firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const now = () => new Date().toISOString();

const BUDGET_STORAGE_KEY = (userId?: string) =>
  userId ? `denegnyj_put_budget_plan_${userId}` : 'denegnyj_put_budget_plan';

const emptyBudgetPlan: BudgetPlan = {
  updatedAt: now(),
  items: [],
};

const loadBudgetPlanFromLocalStorage = (userId?: string): BudgetPlan => {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY(userId));
    if (!raw) return emptyBudgetPlan;
    const parsed = JSON.parse(raw) as BudgetPlan;
    if (!parsed || !Array.isArray(parsed.items)) return emptyBudgetPlan;
    const migrated = parsed.items.map((it) => ({
      ...it,
      plan: typeof it.plan === 'number' ? it.plan : it.amount,
    }));
    return { ...parsed, items: migrated };
  } catch {
    return emptyBudgetPlan;
  }
};

const saveBudgetPlanToLocalStorage = (plan: BudgetPlan, userId?: string): void => {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY(userId), JSON.stringify(plan));
  } catch {
    // ignore quota errors
  }
};

export const loadBudgetPlan = async (userId?: string): Promise<BudgetPlan> => {
  if (isResetPending()) {
    return emptyBudgetPlan;
  }
  if (!userId) {
    return emptyBudgetPlan;
  }
  if (!db) {
    return loadBudgetPlanFromLocalStorage(userId);
  }
  try {
    const docRef = doc(db, COLLECTIONS.budgetPlan, userId ? `users/${userId}/budget_plan` : 'budget_plan');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as BudgetPlan;
      if (parsed && Array.isArray(parsed.items)) {
        const migrated = parsed.items.map((it) => ({
          ...it,
          plan: typeof it.plan === 'number' ? it.plan : it.amount,
        }));
        const result = { ...parsed, items: migrated };
        saveBudgetPlanToLocalStorage(result, userId);
        return result;
      }
    }
  } catch {
    // Firestore недоступен, используем localStorage
  }
  return loadBudgetPlanFromLocalStorage(userId);
};

export const saveBudgetPlan = async (plan: BudgetPlan, userId?: string): Promise<void> => {
  if (!userId) return;
  saveBudgetPlanToLocalStorage(plan, userId);
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.budgetPlan, `users/${userId}/budget_plan`), {
      ...plan,
      userId,
    });
  } catch {
    // ignore quota errors
  }
};

export const resetBudgetPlan = async (_empty = false, userId?: string): Promise<BudgetPlan> => {
  // Чистим и пользовательский, и общий ключ бюджета в localStorage
  try {
    localStorage.removeItem(BUDGET_STORAGE_KEY(userId));
    localStorage.removeItem(BUDGET_STORAGE_KEY(undefined));
  } catch {
    // ignore
  }
  if (!userId) return emptyBudgetPlan;
  saveBudgetPlanToLocalStorage(emptyBudgetPlan, userId);
  return emptyBudgetPlan;
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
