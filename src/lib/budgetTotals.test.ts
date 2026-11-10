import { describe, it, expect } from 'vitest';
import { computeBudgetPageTotals } from './budget';
import type { BudgetPlanItem } from '../types';

const item = (overrides: Partial<BudgetPlanItem>): BudgetPlanItem => ({
  id: '1',
  name: 'Тест',
  amount: 0,
  plan: 0,
  group: 'monthly',
  type: 'item',
  ...overrides,
});

describe('computeBudgetPageTotals', () => {
  it('returns zeros for empty items', () => {
    const t = computeBudgetPageTotals([]);
    expect(t.totalMonthly).toBe(0);
    expect(t.totalPlanned).toBe(0);
    expect(t.totalAll).toBe(0);
    expect(t.totalMonthlyPlan).toBe(0);
    expect(t.totalPlannedPlan).toBe(0);
    expect(t.regularTotal).toBe(0);
  });

  it('sums monthly and planned separately', () => {
    const items: BudgetPlanItem[] = [
      item({ id: '1', group: 'monthly', amount: 100, plan: 200 }),
      item({ id: '2', group: 'monthly', amount: 300, plan: 400 }),
      item({ id: '3', group: 'planned', amount: 50, plan: 60 }),
    ];
    const t = computeBudgetPageTotals(items);
    expect(t.totalMonthly).toBe(400);
    expect(t.totalPlanned).toBe(50);
    expect(t.totalAll).toBe(450);
    expect(t.totalMonthlyPlan).toBe(600);
    expect(t.totalPlannedPlan).toBe(60);
    expect(t.regularTotal).toBe(600);
  });

  it('ignores subtotal and total items', () => {
    const items: BudgetPlanItem[] = [
      item({ id: '1', group: 'monthly', amount: 100, plan: 200, type: 'item' }),
      item({ id: '2', group: 'monthly', amount: 999, plan: 999, type: 'subtotal' }),
      item({ id: '3', group: 'monthly', amount: 888, plan: 888, type: 'total' }),
    ];
    const t = computeBudgetPageTotals(items);
    expect(t.totalMonthly).toBe(100);
    expect(t.totalMonthlyPlan).toBe(200);
  });

  it('handles undefined amount/plan as 0', () => {
    const items: BudgetPlanItem[] = [
      { id: '1', name: 'x', amount: undefined as any, plan: undefined as any, group: 'monthly', type: 'item' },
    ];
    const t = computeBudgetPageTotals(items);
    expect(t.totalMonthly).toBe(0);
    expect(t.totalMonthlyPlan).toBe(0);
  });

  it('regularTotal sums monthly plan and excludes additional-expense plan', () => {
    const items: BudgetPlanItem[] = [
      item({ id: '1', group: 'monthly', amount: 0, plan: 30_900 }),
      item({ id: '2', group: 'planned', amount: 0, plan: 4_000 }),
    ];
    const t = computeBudgetPageTotals(items);
    expect(t.regularTotal).toBe(30_900);
  });
});