import { useEffect, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';

export default function Dashboard() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { items } = useBudget();
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);

  useEffect(() => {
    setPageTitle('Главная');
  }, [setPageTitle]);

  return (
    <div className="page">
      <div className="budget-card">
        <div className="budget-card-header">
          <h2 className="budget-card-title">Расходы</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary">
            <div className="summary-item summary-item-total">
              <span className="summary-label">Общее итого</span>
              <span className="summary-value">{totals.totalAll.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Регулярные</span>
              <span className="summary-value">{totals.regularTotal.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
