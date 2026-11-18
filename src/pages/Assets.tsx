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

export default function Assets() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;
  const { items, addItem, updateItem, removeItem } = useData<Row>({
    collectionName: COLLECTIONS.assets,
    userId,
  });

  useEffect(() => {
    setPageTitle('Активы');
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
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Активы</h1>
        <p className="budget-page-subtitle">Имущество и вложения — то, что приносит вам доход или имеет ценность</p>
      </div>

      {items.length > 0 && (
        <section className="dashboard-kpi-grid income-summary-grid" aria-label="Итоги активов">
        <article className="dashboard-kpi dashboard-kpi-success">
          <span className="dashboard-kpi-label">Итого активы</span>
          <strong className="dashboard-kpi-value">{totals.totalMonthly} ₽</strong>
        </article>
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Доход в месяц</span>
          <strong className="dashboard-kpi-value">{totals.totalMonthlyPlan} ₽</strong>
        </article>
        </section>
      )}

      <BudgetTable
        title="Активы"
        group="monthly"
        items={planned}
        total={totals.totalMonthly}
        totalPlan={totals.totalMonthlyPlan}
        headers={{ amount: 'Сумма', plan: 'В мес.' }}
        onUpdate={updateFromBudget}
        onRemove={removeItem}
        onAdd={addFromBudget}
      />
    </div>
  );
}