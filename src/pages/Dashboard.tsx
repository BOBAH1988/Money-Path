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

interface IncomeRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

interface IncomeArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const migrateArchiveRow = (raw: any): IncomeArchiveRow => {
  const year = typeof raw?.year === 'number' ? raw.year : new Date().getFullYear();
  if (raw && Array.isArray(raw.months) && raw.months.length === 12) {
    return { id: raw.id, name: raw.name ?? '', year, months: raw.months.map((v: any) => (typeof v === 'number' ? v : 0)) };
  }
  const months = new Array(12).fill(0);
  if (typeof raw?.amount === 'number') months[0] = raw.amount;
  if (typeof raw?.monthly === 'number') months[1] = raw.monthly;
  return { id: raw?.id ?? crypto.randomUUID(), name: raw?.name ?? '', year, months };
};

export default function Dashboard() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { items } = useBudget();
  const { user } = useAuth();
  const userId = user?.uid;
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [incomeArchive, setIncomeArchive] = useState<IncomeArchiveRow[]>([]);

  useEffect(() => {
    setPageTitle('Главная');
  }, [setPageTitle]);

  useEffect(() => {
    if (!userId) {
      setAssets([]);
      setLiabilities([]);
      setIncome([]);
      setIncomeArchive([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [a, l, i, ia] = await Promise.all([
          loadFromFirestore<AssetRow>(COLLECTIONS.assets, userId),
          loadFromFirestore<LiabilityRow>(COLLECTIONS.liabilities, userId),
          loadFromFirestore<IncomeRow>(COLLECTIONS.income, userId),
          loadFromFirestore<any>(COLLECTIONS.incomeArchive, userId),
        ]);
        if (!cancelled) {
          setAssets(a);
          setLiabilities(l);
          setIncome(i);
          setIncomeArchive(ia.map(migrateArchiveRow));
        }
      } catch {
        if (!cancelled) {
          setAssets([]);
          setLiabilities([]);
          setIncome([]);
          setIncomeArchive([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalAssets = useMemo(() => assets.reduce((sum, it) => sum + (it.amount ?? 0), 0), [assets]);
  const totalLiabilities = useMemo(() => safeNegate(liabilities.reduce((sum, it) => sum + (it.amount ?? 0), 0)), [liabilities]);

  const incomeAmount = useMemo(() => income.reduce((sum, it) => sum + (it.amount ?? 0), 0), [income]);
  const incomeMonthly = useMemo(() => income.reduce((sum, it) => sum + (it.monthly ?? 0), 0), [income]);

  // Доходы архив: средний доход за текущий год
  const currentYear = new Date().getFullYear();
  const archiveRows = useMemo(() => incomeArchive.filter((r) => r.year === currentYear), [incomeArchive, currentYear]);
  const archiveTotal = useMemo(() => archiveRows.reduce((s, row) => s + row.months.reduce((a, b) => a + (b || 0), 0), 0), [archiveRows]);
  const archiveFilledMonths = useMemo(() => {
    const set = new Set<number>();
    archiveRows.forEach((row) => row.months.forEach((v, idx) => { if (v && v !== 0) set.add(idx); }));
    return set.size;
  }, [archiveRows]);
  const archiveAverage = archiveFilledMonths > 0 ? Math.round(archiveTotal / archiveFilledMonths) : 0;

  const summaryIncome = archiveAverage > 0 ? archiveAverage : 0;
  const summaryExpenses = totals.totalAll;
  const summaryDiff = summaryIncome - summaryExpenses;
  const summaryOk = summaryExpenses < summaryIncome;

  return (
    <div className="page">
      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Сводка</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
            <div className="summary-item summary-item-total">
              <span className="summary-label">Доходы</span>
              <span className="summary-value">{summaryIncome.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Расходы</span>
              <span className="summary-value">{summaryExpenses.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
          <div
            style={{
              margin: '8px 4px 4px',
              padding: '12px 14px',
              borderRadius: 12,
              background: summaryOk ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${summaryOk ? '#6ee7b7' : '#fecaca'}`,
              color: summaryOk ? '#065f46' : '#991b1b',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{summaryOk ? '✅' : '⚠️'}</span>
            <span>
              {summaryOk
                ? `Хорошо: расходы меньше доходов на ${summaryDiff.toLocaleString('ru-RU')} ₽`
                : `Необходимо пересмотреть расходы: расходы превышают доходы на ${Math.abs(summaryDiff).toLocaleString('ru-RU')} ₽`}
            </span>
          </div>
        </div>
      </div>

      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Доходы</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
            <div className="summary-item summary-item-total">
              <span className="summary-label">Средний доход</span>
              <span className="summary-value">{incomeAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Планируемый доход</span>
              <span className="summary-value">{incomeMonthly.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>
      </div>

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
