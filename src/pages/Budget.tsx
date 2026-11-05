import { useMemo } from 'react';
import { useBudget } from '../hooks/useBudget';
import { BudgetTable } from '../components/budget/BudgetTable';

export default function Budget() {
  const { items, updateItem, addItem, removeItem, reset, groupTotal } = useBudget();

  const monthlyItems = useMemo(
    () => items.filter((it) => it.group === 'monthly'),
    [items]
  );
  const plannedItems = useMemo(
    () => items.filter((it) => it.group === 'planned'),
    [items]
  );

  const totalMonthly = groupTotal('monthly');
  const totalPlanned = groupTotal('planned');

  return (
    <div className="page page-budget">
      <div className="budget-page-header">
        <h1>Планирование бюджета</h1>
        <p className="budget-page-subtitle">
          Ежемесячный план расходов. Данные сохраняются автоматически в браузере.
        </p>
        <div className="budget-page-actions">
          <button className="btn-reset" onClick={reset}>
            Сбросить к стандартному
          </button>
        </div>
      </div>

      <div className="budget-grid">
        <BudgetTable
          group="monthly"
          title="Ежемесячные расходы"
          items={monthlyItems}
          total={totalMonthly}
          onUpdate={updateItem}
          onAdd={(group, name, amount) => addItem(group, name, amount)}
          onRemove={removeItem}
        />
        <BudgetTable
          group="planned"
          title="Запланированные расходы"
          items={plannedItems}
          total={totalPlanned}
          onUpdate={updateItem}
          onAdd={(group, name, amount) => addItem(group, name, amount)}
          onRemove={removeItem}
        />
      </div>

      <div className="budget-summary">
        <div className="summary-item">
          <span className="summary-label">Запланированные расходы</span>
          <span className="summary-value">{totalPlanned.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item summary-item-total">
          <span className="summary-label">Итого ежемесячно</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>
    </div>
  );
}
