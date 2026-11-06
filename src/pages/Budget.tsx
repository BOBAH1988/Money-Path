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

  const [plannedVisible, setPlannedVisible] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('denegnyj_put_planned_visible') ?? 'false');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('denegnyj_put_planned_visible', JSON.stringify(plannedVisible));
    } catch {
      // ignore quota errors
    }
  }, [plannedVisible]);

  const handleTogglePlanned = () => {
    const next = !plannedVisible;
    setPlannedVisible(next);
    if (!next) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTimeout(() => {
        const el = document.getElementById('planned-table');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

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
            onUpdate={updateItem}
            onAdd={(group, name, amount, plan) => addItem(group, name, amount, plan)}
            onRemove={removeItem}
          />
        )}
      </div>

      <div className="budget-summary">
        <div className="summary-item summary-item-total">
          <span className="summary-label">Итого</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>
    </div>
  );
}
