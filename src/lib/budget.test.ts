import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type BudgetPlanItem } from '../types';
import {
  computeTotals,
  applyComputedFields,
  safeNegate,
  loadBudgetPlan,
  saveBudgetPlan,
} from './budget';

const mocks = vi.hoisted(() => ({
  loadBudgetPlan: vi.fn(),
  syncPendingToFirestore: vi.fn(),
}));

vi.mock('./firestore', () => ({
  loadBudgetPlan: mocks.loadBudgetPlan,
  syncPendingToFirestore: mocks.syncPendingToFirestore,
}));

const item = (id: string, name: string, amount: number): BudgetPlanItem => ({
  id,
  name,
  amount,
  plan: amount,
  group: 'monthly',
  type: 'item',
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.loadBudgetPlan.mockResolvedValue({ items: [], updatedAt: '' });
  mocks.syncPendingToFirestore.mockResolvedValue(undefined);
});

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

describe('loadBudgetPlan', () => {
  const userId = 'uid-123';

  it('returns empty plan without auth', async () => {
    const plan = await loadBudgetPlan(undefined);
    expect(plan.items.length).toBe(0);
  });

  it('saves and loads a guest budget plan locally', async () => {
    const items = [item('guest-1', 'Локальный план', 100)];

    await saveBudgetPlan({ items, updatedAt: '2026-11-10T00:00:00.000Z' });
    const plan = await loadBudgetPlan(undefined);

    expect(plan.items).toEqual(items);
    expect(plan.updatedAt).toBe('2026-11-10T00:00:00.000Z');
  });

  it('loads from Firestore when document exists', async () => {
    mocks.loadBudgetPlan.mockResolvedValue({
      updatedAt: 't0',
      items: [item('1', 'Актив 1', 100)],
    });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items.length).toBe(1);
    expect(plan.items[0].id).toBe('1');
  });

  it('returns empty plan when Firestore document does not exist', async () => {
    mocks.loadBudgetPlan.mockResolvedValue({ items: [], updatedAt: '' });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items.length).toBe(0);
  });

  it('preserves the error when Firestore fails instead of treating it as empty data', async () => {
    mocks.loadBudgetPlan.mockRejectedValue(new Error('network error'));

    await expect(loadBudgetPlan(userId)).rejects.toThrow('network error');
  });
});
