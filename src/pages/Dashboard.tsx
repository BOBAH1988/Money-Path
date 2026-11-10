import { useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitleContext } from '../components/PageTitleContext';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { clearAccountData, loadFromFirestore, loadLocalCollection, storageKeyFor, COLLECTIONS } from '../lib/firestore';
import { EmptyState } from '../ui/EmptyState';
import { AuthModal } from '../components/AuthModal';
import { LineChart, BarChart } from '../components/dashboard/Charts';
import { YearMonthPicker } from '../components/dashboard/YearMonthPicker';
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
  const { items, reset: resetBudget } = useBudget();
  const { uid, isAuthReady } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const userId = uid;
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const totals = useMemo(() => computeBudgetPageTotals(items), [items]);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [incomeArchive, setIncomeArchive] = useState<IncomeArchiveRow[]>([]);
  const dataRevisionRef = useRef(0);

  const hasData = useMemo(
    () =>
      assets.some((a) => (a.amount ?? 0) > 0) ||
      liabilities.some((l) => (l.amount ?? 0) > 0) ||
      income.some((i) => (i.amount ?? 0) > 0) ||
      incomeArchive.some((r) => r.months.some((v) => v && v !== 0)),
    [assets, liabilities, income, incomeArchive]
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
    const revision = dataRevisionRef.current;
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
          loadFromFirestore<AssetRow>(COLLECTIONS.assets, userId, (fresh) => { if (!cancelled && dataRevisionRef.current === revision) { setAssets(fresh); saveLocal(COLLECTIONS.assets, fresh); } }),
          loadFromFirestore<LiabilityRow>(COLLECTIONS.liabilities, userId, (fresh) => { if (!cancelled && dataRevisionRef.current === revision) { setLiabilities(fresh); saveLocal(COLLECTIONS.liabilities, fresh); } }),
          loadFromFirestore<IncomeRow>(COLLECTIONS.income, userId, (fresh) => { if (!cancelled && dataRevisionRef.current === revision) { setIncome(fresh); saveLocal(COLLECTIONS.income, fresh); } }),
          loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId, (fresh) => { if (!cancelled && dataRevisionRef.current === revision) { const rows = fresh.map(migrateArchiveRow); setIncomeArchive(rows); saveLocal(COLLECTIONS.incomeArchive, rows); } }),
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

  const currentYear = CURRENT_YEAR;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const now = new Date();
    const cur = now.getMonth();
    return (cur - 2 + 12) % 12;
  });

  const averageIncome = useMemo(() => {
    const rows = incomeArchive.filter((r) => r.year === selectedYear);
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
  }, [incomeArchive, selectedYear]);

  const incomeCurrent = averageIncome;

  const summaryIncome = incomeCurrent;
  const summaryExpenses = totals.totalAll;
  const summaryDiff = summaryIncome - summaryExpenses;
  const summaryOk = summaryExpenses <= summaryIncome;
  const summaryEqual = summaryExpenses === summaryIncome;

  const [selectedYearArchive] = useState<number | null>(null);

  const incomeChartData = useMemo(() => {
    const targetYear =
      selectedYearArchive ??
      (Array.isArray(incomeArchive) && incomeArchive.length > 0
        ? incomeArchive[0].year
        : null) ??
      selectedYear;
    const rows = incomeArchive.filter((r) => r.year === targetYear);
    if (rows.length === 0) {
      return new Array(12).fill(0);
    }
    const totalByMonth = new Array(12).fill(0);
    rows.forEach((r) => {
      r.months.forEach((v, idx) => {
        if (v && v !== 0) totalByMonth[idx] += v;
      });
    });
    const max = Math.max(...totalByMonth, 1);
    const normalized = totalByMonth.map((v) => {
      if (v === 0) return 0;
      return Math.round((v / max) * 100);
    });
    return normalized;
  }, [incomeArchive, selectedYear, selectedYearArchive]);

  const [archiveSummary] = useState({
    income: 0,
    plan: 0,
    expense: 0,
  });

  const showChart = incomeChartData.some((v) => v !== 0) || archiveSummary.income > 0;

  if (isLoading) {
    return (
      <div className="page page-budget">
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
      <div className="page page-budget">
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
    <div className="page page-budget">
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Главная</h1>
        <p className="budget-page-subtitle">
          Сводка по доходам, расходам, активам и пассивам за выбранный период
        </p>
        <div className="budget-page-actions">
          <button
            className="btn-reset"
            type="button"
            onClick={async () => {
              try {
                const result = await clearAccountData(userId);
                dataRevisionRef.current += 1;
                setAssets([]);
                setLiabilities([]);
                setIncome([]);
                setIncomeArchive([]);
                await resetBudget(false);
                toastSuccess(
                  result.synced ? 'Данные очищены' : 'Очистка ожидает синхронизации',
                  result.synced ? undefined : 'Удаление сохранено на устройстве и отправится при подключении.',
                );
              } catch (err) {
                toastError('Ошибка очистки данных', err instanceof Error ? err.message : 'Не удалось сохранить очистку');
              }
            }}
          >
            Очистить
          </button>
        </div>
      </div>

      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Настройка периода</h2>
        </div>
        <div className="budget-card-body">
          <div className="year-month-picker">
            <YearMonthPicker
              value={new Date(selectedYear, selectedMonth, 1)}
              onChange={(value) => {
                setSelectedYear(value.getFullYear());
                setSelectedMonth(value.getMonth());
              }}
            />
          </div>
        </div>
      </div>

      {showChart && (
        <>
          <div className="budget-card" style={{ margin: '0 4px' }}>
            <div className="budget-card-header">
              <h2 className="budget-card-title">Доходы за период</h2>
            </div>
            <div className="budget-card-body">
              <div className="budget-summary" style={{ padding: '0 4px' }}>
                <div className="summary-item summary-item-total">
                  <span className="summary-label">Средний доход</span>
                  <span className="summary-value">
                    {incomeCurrent.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Планируемый доход</span>
                  <span className="summary-value">
                    {incomeMonthly.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
              <div className="budget-table-wrap">
                <LineChart data={incomeChartData} labels={MONTHS} />
              </div>
            </div>
          </div>

          <div className="budget-card" style={{ margin: '0 4px' }}>
            <div className="budget-card-header">
              <h2 className="budget-card-title">Распределение расходов</h2>
            </div>
            <div className="budget-card-body">
              <div className="budget-summary" style={{ padding: '0 4px' }}>
                <div className="summary-item summary-item-total">
                  <span className="summary-label">Общее итого</span>
                  <span className="summary-value">
                    {totals.totalAll.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Регулярные расходы</span>
                  <span className="summary-value">
                    {totals.regularTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
              <div className="budget-table-wrap">
                <BarChart
                  series={[
                    {
                      labels: ['Расходы'],
                      values: [totals.totalAll],
                    },
                    {
                      labels: ['Регулярные'],
                      values: [totals.regularTotal],
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="budget-card" style={{ margin: '0 4px' }}>
        <div className="budget-card-header">
          <h2 className="budget-card-title">Сводка</h2>
        </div>
        <div className="budget-card-body">
          <div className="budget-summary" style={{ padding: '0 4px' }}>
            <div className="summary-item summary-item-total">
              <span className="summary-label">Доходы</span>
              <span className="summary-value">
                {summaryIncome.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Расходы</span>
              <span className="summary-value">
                {summaryExpenses.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
          <div
            style={{
              margin: '8px 4px 4px',
              padding: '12px 14px',
              borderRadius: 12,
              background: summaryOk ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)',
              border: `1px solid ${summaryOk ? 'var(--dp-color-success)' : 'var(--dp-color-danger)'}`,
              color: summaryOk ? 'var(--dp-color-success)' : 'var(--dp-color-danger)',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{summaryOk ? '✅' : '⚠️'}</span>
            <span>
              {summaryEqual
                ? 'Расходы равны доходам'
                : summaryOk
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
              <span className="summary-value">
                {incomeAmount.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Планируемый доход</span>
              <span className="summary-value">
                {incomeMonthly.toLocaleString('ru-RU')} ₽
              </span>
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
              <span className="summary-value">
                {totals.totalAll.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Регулярные расходы</span>
              <span className="summary-value">
                {totals.regularTotal.toLocaleString('ru-RU')} ₽
              </span>
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
              <span className="summary-value">
                {totalAssets.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Пассивы итого</span>
              <span className="summary-value">
                {totalLiabilities.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
