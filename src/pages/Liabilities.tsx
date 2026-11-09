import { useContext, useEffect, useMemo } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useData } from '../hooks/useData';
import { EmptyState } from '../ui/EmptyState';
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
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Пассивы</h1>
        <p className="budget-page-subtitle">Долги и обязательства — что вы должны и ежемесячные платежи</p>
      </div>

      {items.length === 0 ? (
        <div className="budget-card">
          <div className="budget-card-body">
            <EmptyState
              icon="🏦"
              title="Пока нет пассивов"
              description="Добавьте кредиты, займы и другие обязательства, чтобы учитывать их в бюджете."
              action={
                <button className="auth-btn" type="button" onClick={() => addItem({ name: '', amount: 0, monthly: 0 })}>
                  Добавить пассив
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <BudgetTable
          title="Пассивы"
          group="monthly"
          items={planned}
          total={totals.totalMonthly}
          totalPlan={totals.totalMonthlyPlan}
          headers={{ amount: 'Сумма', plan: 'В месяц' }}
          onUpdate={updateFromBudget}
          onRemove={removeItem}
          onAdd={addFromBudget}
        />
      )}
      {items.length > 0 && (
        <div className="budget-card" style={{ marginTop: 8 }}>
          <div className="budget-card-body">
            <div className="budget-summary">
              <div className="summary-item summary-item-total">
                <span className="summary-label">Итого долг</span>
                <span className="summary-value">{totals.totalMonthly.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Итого в месяц</span>
                <span className="summary-value">{totals.totalMonthlyPlan.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
