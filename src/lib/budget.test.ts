import { describe, it, expect } from 'vitest';
import { type BudgetPlanItem } from '../types';
import {
  computeTotals,
  applyComputedFields,
  safeNegate,
} from './budget';

describe('safeNegate', () => {
  it('negates positive numbers', () => {
    expect(safeNegate(5)).toBe(-5);
  });
  it('negates negative numbers', () => {
    expect(safeNegate(-5)).toBe(5);
  });
  it('returns 0 for 0 (no -0)', () => {
    expect(safeNegate(0)).toBe(0);
    expect(Object.is(safeNegate(0), -0)).toBe(false);
  });
  it('returns 0 for -0 (no -0)', () => {
    expect(safeNegate(-0)).toBe(0);
    expect(Object.is(safeNegate(-0), -0)).toBe(false);
  });
});
describe('budget lib', () => {
  it('computeTotals returns zeros for empty items', () => {
    const totals = computeTotals([]);
    expect(totals.monthly).toBe(0);
    expect(totals.planned).toBe(0);
  });

  it('computeTotals returns sums for items', () => {
    const items: BudgetPlanItem[] = [
      { id: '1', name: 'Тест', amount: 1000, plan: 1000, group: 'monthly', type: 'item' },
      { id: '2', name: 'Тест2', amount: 2000, plan: 2000, group: 'planned', type: 'item' },
    ];
    const totals = computeTotals(items);
    expect(totals.monthly).toBe(1000);
    expect(totals.planned).toBe(2000);
  });

  it('applyComputedFields returns empty plan for empty items', () => {
    const applied = applyComputedFields([]);
    expect(applied.items.length).toBe(0);
  });

  it('applyComputedFields preserves items', () => {
    const items: BudgetPlanItem[] = [
      { id: '1', name: 'Тест', amount: 1000, plan: 1000, group: 'monthly', type: 'item' },
    ];
    const applied = applyComputedFields(items);
    expect(applied.items.length).toBe(1);
    expect(applied.items[0].name).toBe('Тест');
  });
});
