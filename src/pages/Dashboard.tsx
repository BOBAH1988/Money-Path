import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { loadFromFirestore, COLLECTIONS } from '../lib/firestore';
import { safeNegate } from '../lib/budget';

interface AssetRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

interface LiabilityRow {
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
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);

  useEffect(() => {
    setPageTitle('Главная');
  }, [setPageTitle]);

  useEffect(() => {
    if (!userId) {
      setAssets([]);
      setLiabilities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [a, l] = await Promise.all([
          loadFromFirestore<AssetRow>(COLLECTIONS.assets, userId),
          loadFromFirestore<LiabilityRow>(COLLECTIONS.liabilities, userId),
        ]);
        if (!cancelled) {
          setAssets(a);
          setLiabilities(l);
        }
      } catch {
        if (!cancelled) {
          setAssets([]);
          setLiabilities([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalAssets = useMemo(() => assets.reduce((sum, it) => sum + (it.amount ?? 0), 0), [assets]);
  const totalLiabilities = useMemo(() => safeNegate(liabilities.reduce((sum, it) => sum + (it.amount ?? 0), 0)), [liabilities]);

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
              <span className="summary-label">Регулярные расходы</span>
              <span className="summary-value">{totals.regularTotal.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>

      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Активы и Пассивы</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
            <div className="summary-item summary-item-total">
              <span className="summary-label">Активы итого</span>
              <span className="summary-value">{totalAssets.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Пассивы итого</span>
              <span className="summary-value">{totalLiabilities.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
