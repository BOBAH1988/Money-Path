import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { loadFromFirestore, COLLECTIONS } from '../lib/firestore';
import { safeNegate } from '../lib/budget';
import { format } from '../components/budget/format';
import { EmptyState } from '../ui/EmptyState';
import { LineChart, BarChart, EmptyChart } from '../components/dashboard/Charts';
import { YearMonthPicker } from '../components/dashboard/YearMonthPicker';

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

const getPeriod = (year: number, month: number) => [month, month + 1];

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
          loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId),
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

  const totalAssets = useMemo(
    () => assets.reduce((sum, it) => sum + (it.amount ?? 0), 0),
    [assets]
  );
  const totalLiabilities = useMemo(() => {
    const sum = liabilities.reduce((s, it) => s + (it.amount ?? 0), 0);
    return safeNegate(sum);
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

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    incomeArchive.forEach((row) => {
      if (row.months.some((v) => v && v !== 0)) set.add(row.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [incomeArchive, currentYear]);

  const [chartData, setChartData] = useState<number[]>(() =>
    new Array(12).fill(0)
  );
  const [chartLabels, setChartLabels] = useState<string[]>(MONTHS);

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

  const period = getPeriod(selectedYear, selectedMonth);
  const visibleMonths = useMemo(() => period, [period]);

  const [selectedYearArchive, setSelectedYearArchive] = useState<number | null>(
    null
  );

  const incomeChartData = useMemo(() => {
    const targetYear =
      selectedYearArchive ??
      (Array.isArray(incomeArchive) && incomeArchive.length > 0
        ? incomeArchive[0].year
        : null) ??
      selectedYear;
    const rows = incomeArchive.filter((r) => r.year === targetYear);
    if (rows.length === 0) {
      setChartData(() => new Array(12).fill(0));
      setChartLabels(MONTHS);
      setSelectedYearArchive(null);
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
    setChartData(normalized);
    setChartLabels(MONTHS);
    setSelectedYearArchive(targetYear);
    return normalized;
  }, [incomeArchive, selectedYear, selectedYearArchive]);

  const [archiveSummary, setArchiveSummary] = useState({
    income: 0,
    plan: 0,
    expense: 0,
  });

  const showChart = incomeChartData.some((v) => v !== 0) || archiveSummary.income > 0;

  if (!userId) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <EmptyState
              icon="👋"
              title="Войдите, чтобы увидеть дашборд"
              description="Авторизуйтесь, чтобы увидеть сводку по доходам, расходам, активам и пассивам."
              action={
                <button className="auth-btn" type="button">
                  Войти
                </button>
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
            onClick={() => {
              setAssets([]);
              setLiabilities([]);
              setIncome([]);
              setIncomeArchive([]);
              setChartData(() => new Array(12).fill(0));
              setArchiveSummary({ income: 0, plan: 0, expense: 0 });
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

      {showChart ? (
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
                <LineChart data={incomeChartData} labels={chartLabels} />
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
      ) : (
        <EmptyState
          icon="📊"
          title="Нет данных для визуализации"
          description="Добавьте доходы в архиве или доходы/расходы, чтобы графики отобразили данные."
          action={
            <button className="auth-btn" type="button">
              Перейти к доходам
            </button>
          }
        />
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
