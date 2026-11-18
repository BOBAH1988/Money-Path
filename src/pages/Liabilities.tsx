import { useContext, useEffect, useMemo } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useData } from '../hooks/useData';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup, BudgetPlanItem } from '../types';
import { applyComputedFields, computeBudgetPageTotals } from '../lib/budget';
import '../components/budget/budget.css';

interface Row {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export default function Liabilities() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;
  const { items, addItem, updateItem, removeItem } = useData<Row>({
    collectionName: COLLECTIONS.liabilities,
    userId,
  });

  useEffect(() => {
    setPageTitle('Пассивы');
  }, [setPageTitle]);

  const budgetItems = useMemo<BudgetPlanItem[]>(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount ?? 0,
        plan: it.monthly ?? 0,
        group: 'monthly' as BudgetGroup,
        type: 'item' as const,
      })),
    [items]
  );

  const planned = useMemo(() => applyComputedFields(budgetItems).items, [budgetItems]);
  const totals = useMemo(() => computeBudgetPageTotals(planned), [planned]);

  const updateFromBudget = (id: string, patch: Partial<BudgetPlanItem>) => {
    const next: Partial<Row> = {};
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.amount !== undefined) next.amount = patch.amount;
    if (patch.plan !== undefined) next.monthly = patch.plan;
    updateItem(id, next);
  };

  const addFromBudget = (_group: BudgetGroup, name: string, amount: number, plan: number) => {
    addItem({ name, amount, monthly: plan });
  };

  return (
    <div className="page page-budget">
      {items.length > 0 && (
        <section className="dashboard-kpi-grid income-summary-grid" aria-label="Итоги пассивов">
        <article className="dashboard-kpi dashboard-kpi-danger">
          <span className="dashboard-kpi-label">Итого долг</span>
          <strong className="dashboard-kpi-value">{totals.totalMonthly.toLocaleString('ru-RU')} ₽</strong>
        </article>
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Плата % в месяц</span>
          <strong className="dashboard-kpi-value">{totals.totalMonthlyPlan.toLocaleString('ru-RU')} ₽</strong>
        </article>
        </section>
      )}

      <BudgetTable
        title="Пассивы"
        group="monthly"
        items={planned}
        total={totals.totalMonthly}
        totalPlan={totals.totalMonthlyPlan}
        headers={{ amount: 'Сумма', plan: '% в мес.' }}
        onUpdate={updateFromBudget}
        onRemove={removeItem}
        onAdd={addFromBudget}
      />
    </div>
  );
}