import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type BudgetPlanItem } from '../types';
import {
  computeTotals,
  applyComputedFields,
  safeNegate,
  loadBudgetPlan,
} from './budget';

const mocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  setDoc: mocks.setDoc,
}));

vi.mock('./firebase', () => ({
  firestoreDb: {},
  firebaseError: null,
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
  mocks.doc.mockReturnValue({} as any);
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

  it('loads from Firestore when document exists', async () => {
    mocks.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        updatedAt: 't0',
        userId,
        items: [item('1', 'Актив 1', 100)],
      }),
    });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items.length).toBe(1);
    expect(plan.items[0].id).toBe('1');
  });

  it('returns empty plan when Firestore document does not exist', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false });

    const plan = await loadBudgetPlan(userId);

    expect(plan.items.length).toBe(0);
  });

  it('returns empty plan on Firestore error', async () => {
    mocks.getDoc.mockRejectedValue(new Error('network error'));

    const plan = await loadBudgetPlan(userId);

    expect(plan.items.length).toBe(0);
  });
});
