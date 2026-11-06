import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { loadFromFirestore, COLLECTIONS } from '../lib/firestore';

interface AssetRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export default function Dashboard() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { items } = useBudget();
  const { user } = useAuth();
  const userId = user?.uid;
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);

  const [assets, setAssets] = useState<AssetRow[]>([]);

  useEffect(() => {
    setPageTitle('Главная');
  }, [setPageTitle]);

  useEffect(() => {
    if (!userId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await loadFromFirestore<AssetRow>(COLLECTIONS.assets, userId);
        if (!cancelled) setAssets(data);
      } catch {
        if (!cancelled) setAssets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalAmount = useMemo(() => assets.reduce((sum, it) => sum + (it.amount ?? 0), 0), [assets]);
  const totalMonthly = useMemo(() => assets.reduce((sum, it) => sum + (it.monthly ?? 0), 0), [assets]);

  return (
    <div className="page">
      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Расходы</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
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

      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Активы</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
            <div className="summary-item summary-item-total">
              <span className="summary-label">Итого</span>
              <span className="summary-value">{totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">% в месяц</span>
              <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
