import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import { firestoreDb as db } from './firebase';
import { COLLECTIONS } from './dataStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

const budgetDocRef = (userId: string) => doc(db!, `users/${userId}/${COLLECTIONS.budgetPlan}`, 'budget_plan');
const budgetDocRefLegacy = (userId: string) => doc(db!, COLLECTIONS.budgetPlan, `users/${userId}/budget_plan`);

/* Данные бюджета хранятся только на сервере (Firestore). Локальное хранилище
   больше не используется, чтобы план был одинаковым на всех устройствах после входа
   под одним аккаунтом. */
export const loadBudgetPlan = async (userId?: string): Promise<BudgetPlan> => {
  if (!userId || !db) return emptyBudgetPlan;

  try {
    const read = async (ref: ReturnType<typeof doc>) => {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const parsed = snap.data() as Partial<BudgetPlan> & { items?: unknown[] };
      if (!parsed || !Array.isArray(parsed.items)) return null;
      return { updatedAt: parsed.updatedAt || now(), items: migrateItems(parsed.items) } as BudgetPlan;
    };
    return (await read(budgetDocRef(userId))) ?? (await read(budgetDocRefLegacy(userId))) ?? emptyBudgetPlan;
  } catch {
    return emptyBudgetPlan;
  }
};

export const saveBudgetPlan = async (plan: BudgetPlan, userId?: string): Promise<void> => {
  const normalized: BudgetPlan = { updatedAt: plan.updatedAt || now(), items: migrateItems(plan.items ?? []) };
  if (!userId || !db) return;
  try {
    await setDoc(budgetDocRef(userId), {
      ...normalized,
      userId,
    });
  } catch {
    // ignore
  }
};

export const resetBudgetPlan = async (_empty = false, userId?: string): Promise<BudgetPlan> => {
  const reset = { updatedAt: now(), items: [] as BudgetPlanItem[] };
  if (userId && db) {
    try {
      await setDoc(budgetDocRef(userId), { ...reset, userId });
    } catch {
      // ignore
    }
  }
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
