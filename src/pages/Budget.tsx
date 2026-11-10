import { useMemo, useEffect, useContext, useState } from 'react';
import { useBudget } from '../hooks/useBudget';
import { BudgetTable } from '../components/budget/BudgetTable';
import { PageTitleContext } from '../components/PageTitleContext';
import { computeBudgetPageTotals } from '../lib/budget';

export default function Budget() {
  const { items, updateItem, addItem, removeItem, loading, error } = useBudget();
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Планирование бюджета');
  }, [setPageTitle]);

  const monthlyItems = useMemo(
    () => items.filter((it) => it.group === 'monthly'),
    [items]
  );
  const plannedItems = useMemo(
    () => items.filter((it) => it.group === 'planned'),
    [items]
  );

  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);
  const totalAll = totals.totalAll;
  const totalMonthly = totals.totalMonthly;
  const totalMonthlyPlan = totals.totalMonthlyPlan;
  const totalPlanned = totals.totalPlanned;
  const totalPlannedPlan = totals.totalPlannedPlan;

  const [plannedVisible, setPlannedVisible] = useState(false);

  const handleTogglePlanned = () => {
    setPlannedVisible((prev) => !prev);
  };

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

  return (
    <div className="page page-budget">
      {error && (
        <div className="budget-card" role="status">
          <div className="budget-card-body" style={{ color: 'var(--dp-color-danger)' }}>
            Не удалось обновить данные из облака. Показаны сохранённые на устройстве данные. {error}
          </div>
        </div>
      )}
      <div className="budget-summary">
        <div className="summary-item summary-item-total">
          <span className="summary-label">Общее итого</span>
          <span className="summary-value">{totalAll.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Регулярные расходы</span>
          <span className="summary-value">{totals.regularTotal.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <div className="budget-grid">
        <BudgetTable
          group="monthly"
          title="Ежемесячные расходы"
          items={monthlyItems}
          plannedItems={plannedItems}
          total={totalMonthly}
          totalPlan={totalMonthlyPlan}
          onUpdate={updateItem}
          onAdd={(group, name, amount, plan) => addItem({ group, name, amount, plan, type: 'item' })}
          onRemove={removeItem}
          onToggle={handleTogglePlanned}
          isPlannedCollapsed={!plannedVisible}
        />
        {plannedVisible && (
          <BudgetTable
            id="planned-table"
            group="planned"
            title="Запланированные расходы"
            items={plannedItems}
            total={totalPlanned}
            totalPlan={totalPlannedPlan}
            onUpdate={updateItem}
            onAdd={(group, name, amount, plan) => addItem({ group, name, amount, plan, type: 'item' })}
            onRemove={removeItem}
          />
        )}
      </div>
    </div>
  );
}
