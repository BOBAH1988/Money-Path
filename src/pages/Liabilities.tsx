import { useContext, useEffect, useMemo } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { COLLECTIONS } from '../lib/firestore';
import { safeNegate } from '../lib/budget';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';

interface LiabilityRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export default function Liabilities() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;

  useEffect(() => {
    setPageTitle('Пассивы');
  }, [setPageTitle]);

  const { items, loading, error, addItem, updateItem, removeItem } =
    useCollection<LiabilityRow>({
      collectionName: COLLECTIONS.liabilities,
      userId,
    });

  const budgetItems = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: -it.amount,
        plan: -it.monthly,
        group: 'monthly' as BudgetGroup,
        type: 'item' as const,
      })),
    [items]
  );

  const totalAmount = safeNegate(items.reduce((sum, it) => sum + it.amount, 0));
  const totalMonthly = safeNegate(items.reduce((sum, it) => sum + it.monthly, 0));

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
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                Загрузка данных
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page page-budget">
        <EmptyState
          icon="📉"
          title="Пассивы не добавлены"
          description="Добавьте первый пассив, например кредит или ипотеку."
          action={
            <button
              className="auth-btn"
              type="button"
              onClick={() => addItem({ name: '', amount: 0, monthly: 0 })}
            >
              Добавить пассив
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
          <span className="summary-label">Оплата % в месяц</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <BudgetTable
        id="liabilities-table"
        group="monthly"
        title="Пассивы"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Источник',
          amount: 'Сумма',
          plan: '% в мес.',
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
