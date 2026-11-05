import { describe, it, expect } from 'vitest';
import {
  defaultBudgetPlan,
  computeTotals,
  applyComputedFields,
} from './budget';

describe('budget lib', () => {
  it('default plan contains expected monthly items', () => {
    const monthly = defaultBudgetPlan.items.filter((i) => i.group === 'monthly');
    expect(monthly.some((i) => i.name === 'Ипотека' && i.amount === 12500)).toBe(true);
    expect(monthly.some((i) => i.name === 'Продукты' && i.amount === 20000)).toBe(true);
  });

  it('default plan contains planned items', () => {
    const planned = defaultBudgetPlan.items.filter((i) => i.group === 'planned');
    expect(planned.some((i) => i.name === 'Кредитка' && i.amount === 30000)).toBe(true);
    expect(planned.some((i) => i.name === 'Развлечения' && i.amount === 2000)).toBe(true);
  });

  it('computeTotals returns sums for both groups', () => {
    const totals = computeTotals(defaultBudgetPlan.items);
    // Сумма обычных строк monthly (без subtotal и total):
    // 5300+12500+20000+10000+600+10000+3500+3500 = 65400
    expect(totals.monthly).toBe(65400);
    // 2000+10000+10000+15000+1140+3200+5500+2000+30000 = 78840
    expect(totals.planned).toBe(78840);
  });

  it('applyComputedFields sets subtotal and total correctly', () => {
    const applied = applyComputedFields(defaultBudgetPlan.items);
    const subtotal = applied.items.find((i) => i.type === 'subtotal');
    const total = applied.items.find((i) => i.type === 'total' && i.group === 'monthly');
    expect(subtotal?.amount).toBe(78840); // сумма planned
    expect(total?.amount).toBe(65400 + 78840); // 144240
  });
});