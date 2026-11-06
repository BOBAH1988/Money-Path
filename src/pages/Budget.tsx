import { useMemo, useEffect, useContext, useState } from 'react';
import { useBudget } from '../hooks/useBudget';
import { BudgetTable } from '../components/budget/BudgetTable';
import { PageTitleContext } from '../components/Layout';

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

  const totalMonthly = useMemo(
    () =>
      items
        .filter((it) => it.group === 'monthly' && it.type === 'item')
        .reduce((sum, it) => sum + it.amount, 0),
    [items]
  );
  const totalPlanned = useMemo(
    () =>
      items
        .filter((it) => it.group === 'planned' && it.type === 'item')
        .reduce((sum, it) => sum + it.amount, 0),
    [items]
  );

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

  if (loading) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                Загрузка данных
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                  Ошибка загрузки данных
                </div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>{error}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Убедитесь, что база Firestore создана в консоли Firebase и правила доступа открыты.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-budget">
      <div className="budget-summary">
        <div className="summary-item summary-item-total">
          <span className="summary-label">Итого</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Запланированные расходы</span>
          <span className="summary-value">{totalPlanned.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

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
    </div>
  );
}
