import { useContext, useEffect, useMemo } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { COLLECTIONS } from '../lib/firestore';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';
import { PageLoader } from '../components/PageLoader';

interface AssetRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export default function Assets() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;

  useEffect(() => {
    setPageTitle('Активы');
  }, [setPageTitle]);

  const { items, loading, error, addItem, updateItem, removeItem } =
    useData<AssetRow>({
      collectionName: COLLECTIONS.assets,
      userId,
    });

  const budgetItems = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount,
        plan: it.monthly,
        group: 'monthly' as BudgetGroup,
        type: 'item' as const,
      })),
    [items]
  );

  const totalAmount = items.reduce((sum: number, it: AssetRow) => sum + it.amount, 0);
  const totalMonthly = items.reduce((sum: number, it: AssetRow) => sum + it.monthly, 0);

  if (error) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--dp-color-danger)' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                  Ошибка загрузки данных
                </div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-budget">
        <PageLoader text="Загрузка данных" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page page-budget">
        <EmptyState
          icon="📈"
          title="Активы не добавлены"
          description="Добавьте первый актив, например банковский вклад или инвестиции."
          action={
            <button
              className="auth-btn"
              type="button"
              onClick={() => addItem({ name: '', amount: 0, monthly: 0 })}
            >
              Добавить актив
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page page-budget">
      <div className="budget-summary">
        <div className="summary-item summary-item-total">
          <span className="summary-label">Итого</span>
          <span className="summary-value">{totalAmount.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Дивиденды в месяц</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <BudgetTable
        id="assets-table"
        group="monthly"
        title="Активы"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Источник',
          amount: 'Сумма',
          plan: '%',
        }}
        onUpdate={(id, patch) => {
          updateItem(id, {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.amount !== undefined && { amount: patch.amount }),
            ...(patch.plan !== undefined && { monthly: patch.plan }),
          });
        }}
        onAdd={(_group, name, amount, plan) => {
          addItem({ name, amount, monthly: plan });
        }}
        onRemove={removeItem}
      />
    </div>
  );
}
