import type { BudgetPlan, BudgetPlanItem, BudgetGroup } from '../types';
import { firestoreDb as db, COLLECTIONS } from './firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const now = () => new Date().toISOString();

const uid = () => crypto.randomUUID();

const BUDGET_STORAGE_KEY = 'denegnyj_put_budget_plan';

export const defaultBudgetPlan: BudgetPlan = {
  updatedAt: now(),
  items: [
    // Ежемесячные расходы
    { id: uid(), name: 'Налоги, обслуживание карт', amount: 5300, plan: 5300, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Ипотека', amount: 12500, plan: 12500, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Продукты', amount: 20000, plan: 20000, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Коммунальные расходы', amount: 10000, plan: 10000, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Стрижка', amount: 600, plan: 600, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Бензин, обслуживание авто', amount: 10000, plan: 10000, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Абонемент в спортзал', amount: 3500, plan: 3500, group: 'monthly', type: 'item' },
    { id: uid(), name: 'Ксюше на кружки', amount: 3500, plan: 3500, group: 'monthly', type: 'item' },
    {
      id: uid(),
      name: 'Запланированные расходы',
      amount: 78840,
      plan: 78840,
      group: 'monthly',
      type: 'subtotal',
      linkedGroup: 'planned',
    },
    { id: uid(), name: 'Итого:', amount: 144240, plan: 144240, group: 'monthly', type: 'total' },

    // Запланированные расходы
    { id: uid(), name: 'Развлечения', amount: 2000, plan: 2000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Пополнение буфера', amount: 10000, plan: 10000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Деду', amount: 10000, plan: 10000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Аванс', amount: 15000, plan: 15000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Заказы', amount: 1140, plan: 1140, group: 'planned', type: 'item' },
    { id: uid(), name: 'Сход развал', amount: 3200, plan: 3200, group: 'planned', type: 'item' },
    { id: uid(), name: 'Подписка PS', amount: 5500, plan: 5500, group: 'planned', type: 'item' },
    { id: uid(), name: 'ДР Юры', amount: 2000, plan: 2000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Кредитка', amount: 30000, plan: 30000, group: 'planned', type: 'item' },
    { id: uid(), name: 'Итого:', amount: 78840, plan: 78840, group: 'planned', type: 'total' },
  ],
};

const loadBudgetPlanFromLocalStorage = (): BudgetPlan => {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) return defaultBudgetPlan;
    const parsed = JSON.parse(raw) as BudgetPlan;
    if (!parsed || !Array.isArray(parsed.items)) return defaultBudgetPlan;
    const migrated = parsed.items.map((it) => ({
      ...it,
      plan: typeof it.plan === 'number' ? it.plan : it.amount,
    }));
    return { ...parsed, items: migrated };
  } catch {
    return defaultBudgetPlan;
  }
};

const saveBudgetPlanToLocalStorage = (plan: BudgetPlan): void => {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // ignore quota errors
  }
};

export const loadBudgetPlan = async (): Promise<BudgetPlan> => {
  if (!db) {
    return loadBudgetPlanFromLocalStorage();
  }
  // Пытаемся загрузить из Firestore
  try {
    const docRef = doc(db, COLLECTIONS.budgetPlan, 'budget_plan');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const parsed = docSnap.data() as BudgetPlan;
      if (parsed && Array.isArray(parsed.items)) {
        const migrated = parsed.items.map((it) => ({
          ...it,
          plan: typeof it.plan === 'number' ? it.plan : it.amount,
        }));
        const result = { ...parsed, items: migrated };
        // Синхронизируем в localStorage
        saveBudgetPlanToLocalStorage(result);
        return result;
      }
    }
  } catch {
    // Firestore недоступен, используем localStorage
  }
  // Fallback на localStorage
  return loadBudgetPlanFromLocalStorage();
};

export const saveBudgetPlan = async (plan: BudgetPlan): Promise<void> => {
  // Всегда сохраняем в localStorage
  saveBudgetPlanToLocalStorage(plan);
  // Пытаемся сохранить в Firestore
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.budgetPlan, 'budget_plan'), plan);
  } catch {
    // ignore quota errors
  }
};

export const resetBudgetPlan = async (empty = false): Promise<BudgetPlan> => {
  if (empty) {
    const emptyPlan: BudgetPlan = {
      updatedAt: now(),
      items: [
        { id: uid(), name: 'Введите название', amount: 0, plan: 0, group: 'monthly', type: 'item' },
      ],
    };
    saveBudgetPlanToLocalStorage(emptyPlan);
    if (!db) return emptyPlan;
    try {
      await setDoc(doc(db, COLLECTIONS.budgetPlan, 'budget_plan'), emptyPlan);
    } catch {
      // ignore
    }
    return emptyPlan;
  }
  saveBudgetPlanToLocalStorage(defaultBudgetPlan);
  if (!db) return defaultBudgetPlan;
  try {
    await setDoc(doc(db, COLLECTIONS.budgetPlan, 'budget_plan'), defaultBudgetPlan);
  } catch {
    // ignore
  }
  return defaultBudgetPlan;
};

export const computeTotals = (items: BudgetPlanItem[]): Record<BudgetGroup, number> => {
  const totals: Record<BudgetGroup, number> = { monthly: 0, planned: 0 };
  items.forEach((it) => {
    if (it.type === 'item') {
      totals[it.group] += it.amount;
    }
  });
  return totals;
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
