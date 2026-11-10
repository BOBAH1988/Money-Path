import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitleContext } from '../components/PageTitleContext';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { loadFromFirestore, loadLocalCollection, storageKeyFor, COLLECTIONS } from '../lib/firestore';
import { EmptyState } from '../ui/EmptyState';
import { AuthModal } from '../components/AuthModal';
import { BarChart } from '../components/dashboard/Charts';
import { useToast } from '../ui/Toast';

const CURRENT_YEAR = new Date().getFullYear();

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

const migrateArchiveRow = (raw: {
  id?: string;
  name?: string;
  year?: number;
  months?: number[];
  amount?: number;
  monthly?: number;
}): IncomeArchiveRow => {
  const year = typeof raw?.year === 'number' ? raw.year : new Date().getFullYear();
  if (raw && Array.isArray(raw.months) && raw.months.length === 12) {
    return {
      id: raw.id ?? crypto.randomUUID(),
      name: raw.name ?? '',
      year,
      months: raw.months.map((v) => (typeof v === 'number' ? v : 0)),
    };
  }
  const months = new Array(12).fill(0);
  if (typeof raw?.amount === 'number') months[0] = raw.amount;
  if (typeof raw?.monthly === 'number') months[1] = raw.monthly;
  return {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? '',
    year,
    months,
  };
};

const MONTHS = [
  'Янв.',
  'Фев.',
  'Март',
  'Апр.',
  'Май',
  'Июн.',
  'Июл.',
  'Авг.',
  'Сент.',
  'Окт.',
  'Нояб.',
  'Дек.',
];

export default function Dashboard() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { items } = useBudget();
  const { uid, isAuthReady } = useAuth();
  const { error: toastError } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const userId = uid;
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [incomeArchive, setIncomeArchive] = useState<IncomeArchiveRow[]>([]);

  const hasData = useMemo(
    () =>
      assets.some((a) => (a.amount ?? 0) > 0) ||
      assets.some((a) => (a.monthly ?? 0) > 0) ||
      liabilities.some((l) => (l.amount ?? 0) > 0) ||
      liabilities.some((l) => (l.monthly ?? 0) > 0) ||
      income.some((i) => (i.amount ?? 0) > 0) ||
      income.some((i) => (i.monthly ?? 0) > 0) ||
      totals.totalAll > 0 ||
      incomeArchive.some((r) => r.months.some((v) => v && v !== 0)),
    [assets, liabilities, income, incomeArchive, totals.totalAll]
  );

  useEffect(() => {
    setPageTitle('Главная');
  }, [setPageTitle]);

  useEffect(() => {
    if (!isAuthReady) {
      setIsLoading(true);
      return;
    }
    let cancelled = false;
    setAssets(loadLocalCollection<AssetRow>(COLLECTIONS.assets, userId));
    setLiabilities(loadLocalCollection<LiabilityRow>(COLLECTIONS.liabilities, userId));
    setIncome(loadLocalCollection<IncomeRow>(COLLECTIONS.income, userId));
    setIncomeArchive(loadLocalCollection<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId).map(migrateArchiveRow));
    setIsLoading(false);

    if (!userId) return () => { cancelled = true; };

    (async () => {
      try {
        const saveLocal = <T,>(name: string, rows: T[]) => {
          try { localStorage.setItem(storageKeyFor(name, userId), JSON.stringify(rows)); } catch {}
        };
        await Promise.all([
          loadFromFirestore<AssetRow>(COLLECTIONS.assets, userId, (fresh) => { if (!cancelled) { setAssets(fresh); saveLocal(COLLECTIONS.assets, fresh); } }),
          loadFromFirestore<LiabilityRow>(COLLECTIONS.liabilities, userId, (fresh) => { if (!cancelled) { setLiabilities(fresh); saveLocal(COLLECTIONS.liabilities, fresh); } }),
          loadFromFirestore<IncomeRow>(COLLECTIONS.income, userId, (fresh) => { if (!cancelled) { setIncome(fresh); saveLocal(COLLECTIONS.income, fresh); } }),
          loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId, (fresh) => { if (!cancelled) { const rows = fresh.map(migrateArchiveRow); setIncomeArchive(rows); saveLocal(COLLECTIONS.incomeArchive, rows); } }),
        ]);
      } catch {
        if (!cancelled) toastError('Ошибка синхронизации', 'Показаны сохранённые на устройстве данные.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthReady, toastError]);

  const totalAssets = useMemo(
    () => assets.reduce((sum, it) => sum + (it.amount ?? 0), 0),
    [assets]
  );
  const totalLiabilities = useMemo(() => {
    const sum = liabilities.reduce((s, it) => s + (it.amount ?? 0), 0);
    return -sum;
  }, [liabilities]);

  const incomeAmount = useMemo(
    () => income.reduce((sum, it) => sum + (it.amount ?? 0), 0),
    [income]
  );
  const incomeMonthly = useMemo(
    () => income.reduce((sum, it) => sum + (it.monthly ?? 0), 0),
    [income]
  );

  const archiveYear = useMemo(
    () => incomeArchive.length
      ? incomeArchive.reduce((latest, row) => Math.max(latest, row.year), incomeArchive[0].year)
      : CURRENT_YEAR,
    [incomeArchive],
  );

  const averageIncome = useMemo(() => {
    const rows = incomeArchive.filter((r) => r.year === archiveYear);
    if (rows.length === 0) return 0;
    const total = rows.reduce(
      (s, r) => s + r.months.reduce((a, b) => a + (b || 0), 0),
      0
    );
    const filled = new Set<number>();
    rows.forEach((r) =>
      r.months.forEach((v, idx) => {
        if (v && v !== 0) filled.add(idx);
      })
    );
    return filled.size > 0 ? Math.round(total / filled.size) : 0;
  }, [incomeArchive, archiveYear]);

  const summaryIncome = incomeAmount;
  const summaryExpenses = totals.totalAll;
  const summaryDiff = summaryIncome - summaryExpenses;
  const summaryEqual = summaryExpenses === summaryIncome;

  const monthlyArchiveIncome = useMemo(() => {
    const rows = incomeArchive.filter((r) => r.year === archiveYear);
    if (rows.length === 0) {
      return new Array(12).fill(0);
    }
    const totalByMonth = new Array(12).fill(0);
    rows.forEach((r) => {
      r.months.forEach((v, idx) => {
        if (v && v !== 0) totalByMonth[idx] += v;
      });
    });
    return totalByMonth;
  }, [incomeArchive, archiveYear]);

  const hasArchivedIncome = monthlyArchiveIncome.some((value) => value !== 0);

  if (isLoading) {
    return (
      <div className="page page-budget page-dashboard">
        <div className="budget-card">
          <div className="budget-card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--theme-text-muted)' }}>
            Загрузка данных…
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="page page-budget page-dashboard">
        <div className="budget-card">
          <div className="budget-card-body">
            <EmptyState
              icon="📊"
              title="Нет данных для визуализации"
              description={
                userId
                  ? 'Добавьте доходы в архиве или доходы/расходы, чтобы графики отобразили данные.'
                  : 'В гостевом режиме данные хранятся на этом устройстве. Войдите для синхронизации между устройствами.'
              }
              action={
                <>
                  <button className="auth-btn" type="button" onClick={() => navigate('/income')}>
                    Перейти к доходам
                  </button>
                  {!userId && (
                    <button className="auth-btn" type="button" onClick={() => setAuthOpen(true)} style={{ marginLeft: 8 }}>
                      Войти
                    </button>
                  )}
                  {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
                </>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-budget page-dashboard">
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Главная</h1>
        <p className="budget-page-subtitle">
          Сводка по текущему бюджету и архив доходов по месяцам
        </p>
      </div>

      <div className="dashboard-scales">
        <section className="dashboard-scale-group">
          <h2>Доходы и расходы</h2>
          <BarChart
            series={[
              { labels: ['Доходы'], values: [summaryIncome] },
              { labels: ['Расходы'], values: [summaryExpenses] },
              { labels: ['Остаток'], values: [summaryDiff] },
            ]}
          />
          <p className={`dashboard-scale-note${summaryDiff < 0 ? ' dashboard-scale-note-danger' : ''}`}>
            {summaryEqual
              ? 'Расходы равны доходам'
              : summaryDiff > 0
                ? `Остаток после расходов: ${summaryDiff.toLocaleString('ru-RU')} ₽`
                : `Расходы превышают доходы на ${Math.abs(summaryDiff).toLocaleString('ru-RU')} ₽`}
          </p>
        </section>

        <section className="dashboard-scale-group">
          <h2>Расходы</h2>
          <BarChart
            series={[
              { labels: ['Расходы в текущем месяце'], values: [totals.totalAll] },
              { labels: ['Регулярные расходы'], values: [totals.regularTotal] },
            ]}
          />
        </section>

        <section className="dashboard-scale-group">
          <h2>Доходы</h2>
          <BarChart
            series={[
              { labels: ['Текущие доходы'], values: [incomeAmount] },
              { labels: ['Планируемый доход'], values: [incomeMonthly] },
            ]}
          />
        </section>

        <section className="dashboard-scale-group">
          <h2>Активы и пассивы</h2>
          <BarChart
            series={[
              { labels: ['Активы'], values: [totalAssets] },
              { labels: ['Пассивы'], values: [totalLiabilities] },
            ]}
          />
        </section>

        {hasArchivedIncome && (
          <section className="dashboard-scale-group dashboard-scale-archive">
            <h2>Архив доходов за {archiveYear} год</h2>
            <BarChart
              series={[
                { labels: ['Средний доход за год'], values: [averageIncome] },
                ...MONTHS.map((month, index) => ({
                  labels: [month],
                  values: [monthlyArchiveIncome[index] ?? 0],
                })),
              ]}
            />
          </section>
        )}
      </div>
    </div>
  );
}
