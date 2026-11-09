import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BudgetTable } from './BudgetTable';
import { ToastProvider } from '../../ui/Toast';
import type { BudgetPlanItem } from '../../types';

afterEach(() => cleanup());
afterEach(() => {
  vi.restoreAllMocks();
});

const buildItem = (overrides: Partial<BudgetPlanItem>): BudgetPlanItem => ({
  id: crypto.randomUUID(),
  name: 'Тест',
  amount: 0,
  plan: 0,
  group: 'monthly',
  type: 'item',
  ...overrides,
});

const renderTable = (props: Partial<Parameters<typeof BudgetTable>[0]>) => {
  const defaultProps: Parameters<typeof BudgetTable>[0] = {
    group: 'monthly',
    title: 'Ежемесячные расходы',
    items: [],
    total: 0,
    onUpdate: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    ...props,
  };
  return render(
    <ToastProvider>
      <BudgetTable {...defaultProps} />
    </ToastProvider>
  );
};

const getFooterRow = (container: HTMLElement) =>
  container.querySelector('tr.budget-row.total');
const getSubtotalRow = (container: HTMLElement) =>
  container.querySelector('tr.budget-row.subtotal');

describe('BudgetTable totals', () => {
  it('footer row shows combined amount/plan totals (monthly + planned) when plannedItems are provided', () => {
    const monthlyItems: BudgetPlanItem[] = [
      buildItem({ id: 'm1', group: 'monthly', amount: 1000, plan: 2000 }),
      buildItem({ id: 'm2', group: 'monthly', amount: 3000, plan: 4000 }),
    ];
    const plannedItems: BudgetPlanItem[] = [
      buildItem({ id: 'p1', group: 'planned', amount: 700, plan: 900 }),
    ];

    const { container } = renderTable({
      items: monthlyItems,
      plannedItems,
      total: 4000, // sum of monthly amounts
      totalPlan: 6000, // sum of monthly plans
    });

    const footer = getFooterRow(container);
    expect(footer).not.toBeNull();
    const amountCell = footer!.querySelector('.budget-cell-amount');
    const planCell = footer!.querySelector('.budget-cell-plan');
    expect(amountCell?.textContent).toContain('4 700');
    expect(planCell?.textContent).toContain('6 900');
  });

  it('footer row is zero when there are no monthly items', () => {
    const { container } = renderTable({
      items: [],
      plannedItems: [
        buildItem({ id: 'p1', group: 'planned', amount: 500, plan: 500 }),
      ],
      total: 0,
      totalPlan: 0,
    });

    const footer = getFooterRow(container);
    expect(footer).not.toBeNull();
    const amountCell = footer!.querySelector('.budget-cell-amount');
    const planCell = footer!.querySelector('.budget-cell-plan');
    expect(amountCell?.textContent).toContain('0');
    expect(planCell?.textContent).toContain('0');
  });
});

describe('BudgetTable additional expenses row (subtotal)', () => {
  it('shows planned items sum in amount and plan columns', () => {
    const monthlyItems: BudgetPlanItem[] = [
      buildItem({ id: 'm1', group: 'monthly', amount: 1000, plan: 1000 }),
    ];
    const plannedItems: BudgetPlanItem[] = [
      buildItem({ id: 'p1', group: 'planned', amount: 3000, plan: 4000 }),
      buildItem({ id: 'p2', group: 'planned', amount: 700, plan: 300 }),
    ];

    // no explicit subtotal item -> inline subtotal row is rendered
    const { container } = renderTable({
      items: monthlyItems,
      plannedItems,
      total: 1000,
      totalPlan: 1000,
    });

    const row = getSubtotalRow(container);
    expect(row).not.toBeNull();
    const amounts = row!.querySelectorAll('.row-amount');
    expect(amounts[0]?.textContent).toBe('3 700'); // 3000 + 700
    expect(amounts[1]?.textContent).toBe('4 300'); // 4000 + 300
  });

  it('shows zero when there are no planned items', () => {
    const monthlyItems: BudgetPlanItem[] = [
      buildItem({ id: 'm1', group: 'monthly', amount: 1000, plan: 1000 }),
    ];

    const { container } = renderTable({
      items: monthlyItems,
      plannedItems: [],
      total: 1000,
      totalPlan: 1000,
    });

    const row = getSubtotalRow(container);
    expect(row).not.toBeNull();
    const amounts = row!.querySelectorAll('.row-amount');
    expect(amounts[0]?.textContent).toBe('0');
    expect(amounts[1]?.textContent).toBe('0');
  });

  it('does not render inline subtotal row when explicit subtotal item exists', () => {
    const monthlyItems: BudgetPlanItem[] = [
      buildItem({ id: 'm1', group: 'monthly', amount: 1000, plan: 1000 }),
      buildItem({
        id: 'sub1',
        group: 'monthly',
        amount: 1000,
        plan: 1000,
        type: 'subtotal',
        linkedGroup: 'planned',
      }),
    ];

    const { container } = renderTable({
      items: monthlyItems,
      plannedItems: [
        buildItem({ id: 'p1', group: 'planned', amount: 500, plan: 500 }),
      ],
      total: 1000,
      totalPlan: 1000,
    });

    const subtotalRows = container.querySelectorAll('tr.budget-row.subtotal');
    expect(subtotalRows.length).toBe(1);
    // explicit subtotal renders BudgetRow with the item's name, not the inline
    // 'Дополнительные расходы' label
    const nameCell = subtotalRows[0]!.querySelector('.row-name');
    expect(nameCell?.textContent).toBe('Тест');
    expect(container.textContent).not.toContain('Дополнительные расходы');
  });
});
