import { useMemo, useEffect, useContext, useState } from 'react';
import { useBudget } from '../hooks/useBudget';
import { BudgetTable } from '../components/budget/BudgetTable';
import { PageTitleContext } from '../components/Layout';

export default function Budget() {
  const { items, updateItem, addItem, removeItem, groupTotal } = useBudget();
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

  const totalMonthly = groupTotal('monthly');
  const totalPlanned = groupTotal('planned');

  const [plannedVisible, setPlannedVisible] = useState(true);

  return (
    <div className="page page-budget">
      <div className="budget-grid">
        <BudgetTable
          group="monthly"
          title="Ежемесячные расходы"
          items={monthlyItems}
          total={totalMonthly}
          onUpdate={updateItem}
          onAdd={(group, name, amount, plan) => addItem(group, name, amount, plan)}
          onRemove={removeItem}
          onToggle={() => setPlannedVisible((v) => !v)}
        />
        {plannedVisible && (
          <BudgetTable
            group="planned"
            title="Запланированные расходы"
            items={plannedItems}
            total={totalPlanned}
            onUpdate={updateItem}
            onAdd={(group, name, amount, plan) => addItem(group, name, amount, plan)}
            onRemove={removeItem}
          />
        )}
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
