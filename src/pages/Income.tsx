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

export default function Income() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;
  const { items, addItem, updateItem, removeItem } = useData<Row>({
    collectionName: COLLECTIONS.income,
    userId,
  });

  useEffect(() => {
    setPageTitle('Доходы');
  }, [setPageTitle]);

  useEffect(() => {
    items
      .filter((item) => !(item.name ?? '').trim() && !item.amount && !item.monthly)
      .forEach((item) => removeItem(item.id));
  }, [items, removeItem]);

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
        <h1 className="budget-page-header h1">Доходы</h1>
        <p className="budget-page-subtitle">Источники дохода — текущие и планируемые поступления</p>
      </div>

      <BudgetTable
        title="Доходы"
        group="monthly"
        items={planned}
        total={totals.totalMonthly}
        totalPlan={totals.totalMonthlyPlan}
        headers={{ amount: 'Сумма', plan: 'План' }}
        onUpdate={updateFromBudget}
        onRemove={removeItem}
        onAdd={addFromBudget}
      />
      {items.length > 0 && (
        <div className="budget-card" style={{ marginTop: 8 }}>
          <div className="budget-card-body">
            <div className="budget-summary">
              <div className="summary-item summary-item-total">
                <span className="summary-label">Итого сумма</span>
                <span className="summary-value">{totals.totalMonthly.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Итого план</span>
                <span className="summary-value">{totals.totalMonthlyPlan.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
