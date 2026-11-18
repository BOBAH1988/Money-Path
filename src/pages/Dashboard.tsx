import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitleContext } from '../components/PageTitleContext';
import { useBudget } from '../hooks/useBudget';
import { computeBudgetPageTotals } from '../lib/budget';
import { useAuth } from '../context/AuthContext';
import { loadFromFirestore, loadLocalCollection, storageKeyFor, COLLECTIONS, syncPendingToFirestore } from '../lib/firestore';
import { EmptyState } from '../ui/EmptyState';
import { AuthModal } from '../components/AuthModal';
import { resolveActiveMonth } from '../lib/incomeArchive';
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
        // Сначала отправляем накопленные локальные изменения в облако,
        // чтобы серверный снимок не перезаписал неотправленные правки.
        await syncPendingToFirestore(userId);
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

  // Доходы берём из архива: месяц считается новым, когда в нём появились данные,
  // а не с 1-го числа — зарплата обычно приходит около 12-го.
  const activeMonth = useMemo(() => resolveActiveMonth(incomeArchive), [incomeArchive]);
  const currentMonthIncome = useMemo(
    () =>
      incomeArchive
        .filter((row) => row.year === activeMonth.year)
        .reduce((sum, row) => sum + (row.months[activeMonth.index] || 0), 0),
    [incomeArchive, activeMonth],
  );

  // Средний доход считается так же, как на странице «Доходы»: берётся активный
  // год, суммируются все его месяцы и делятся на число месяцев с данными.
  const averageIncome = useMemo(() => {
    const yearItems = incomeArchive.filter((row) => row.year === activeMonth.year);
    const grandTotal = yearItems.reduce(
      (sum, row) => sum + row.months.reduce((s, value) => s + (value || 0), 0),
      0,
    );
    const filledMonths = new Set<number>();
    yearItems.forEach((row) =>
      row.months.forEach((value, index) => {
        if (value) filledMonths.add(index);
      }),
    );
    return filledMonths.size > 0 ? Math.round(grandTotal / filledMonths.size) : 0;
  }, [incomeArchive, activeMonth.year]);

  const currentMonthLabel = MONTHS[activeMonth.index];
  const summaryIncome = currentMonthIncome;
  const summaryExpenses = totals.totalAll;


  const formatMoney = (value: number) =>
    `${Math.round(value).toLocaleString('ru-RU')} ₽`;

  const netWorth = totalAssets + totalLiabilities;

  // Баланс месяца строится от фактических доходов месяца: из них часть уже
  // ушла на оплату бюджета, остаток — это ещё не оплаченные строки.
  // Свободные деньги не рассчитываются: они сразу уходят на счёт.
  const plannedExpenses = summaryIncome;
  const paidFromPlan = Math.max(plannedExpenses - summaryExpenses, 0);

  const balanceSegments = [
    {
      key: 'planned',
      label: 'Запланировано',
      value: plannedExpenses,
      className: 'dashboard-balance-segment-planned',
    },
    {
      key: 'remaining',
      label: 'Остаток расходов',
      value: summaryExpenses,
      className: 'dashboard-balance-segment-expenses',
    },
  ].filter((segment) => segment.value > 0);

  // Длина полосы — план бюджета, а «Остаток расходов» рисуется поверх как доля
  // от него: видно, сколько из запланированной суммы ещё не оплачено.
  const balanceTotal = plannedExpenses;

  const recentMonths = useMemo(() => {
    const totalsByMonth = new Array(12).fill(0);
    incomeArchive
      .filter((row) => row.year === CURRENT_YEAR)
      .forEach((row) => {
        row.months.forEach((value, index) => {
          if (value) totalsByMonth[index] += value;
        });
      });
    return totalsByMonth
      .map((value, index) => ({ label: MONTHS[index], value }))
      .filter((month) => month.value > 0)
      .slice(-6);
  }, [incomeArchive]);
  const recentMax = Math.max(...recentMonths.map((month) => month.value), 0);

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
      <section className="dashboard-kpi-grid" aria-label="Ключевые показатели">
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Доходы за месяц</span>
          <strong className="dashboard-kpi-value">{formatMoney(summaryIncome)}</strong>
          <span className="dashboard-kpi-note">{currentMonthLabel}</span>
        </article>
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Средний доход</span>
          <strong className="dashboard-kpi-value">{formatMoney(averageIncome)}</strong>
          <span className="dashboard-kpi-note">в месяц</span>
        </article>
        <article className="dashboard-kpi dashboard-kpi-success">
          <span className="dashboard-kpi-label">Остаток расходов</span>
          <strong className="dashboard-kpi-value">{formatMoney(summaryExpenses)}</strong>
          <span className="dashboard-kpi-note">
            из {formatMoney(summaryIncome)} запланировано
          </span>
        </article>
        <article className={`dashboard-kpi${netWorth < 0 ? ' dashboard-kpi-danger' : ''}`}>
          <span className="dashboard-kpi-label">Чистый капитал</span>
          <strong className="dashboard-kpi-value">{formatMoney(netWorth)}</strong>
          <span className="dashboard-kpi-note">
            активы {formatMoney(totalAssets)} · пассивы {formatMoney(Math.abs(totalLiabilities))}
          </span>
        </article>
      </section>

      <div className="dashboard-scales">
        <section className="dashboard-scale-group">
          <h2>Баланс месяца</h2>
          {plannedExpenses > 0 && balanceTotal > 0 ? (
            <>
              <div className="dashboard-balance-bar" role="img" aria-label="План бюджета месяца и остаток к оплате">
                {balanceSegments.map((segment) => (
                  <div
                    key={segment.key}
                    className={`dashboard-balance-segment ${segment.className}`}
                    style={{ width: `${Math.min((segment.value / balanceTotal) * 100, 100)}%` }}
                    title={`${segment.label}: ${formatMoney(segment.value)}`}
                  />
                ))}
              </div>
              <ul className="dashboard-balance-legend">
                {balanceSegments.map((segment) => (
                  <li key={segment.key}>
                    <span className={`dashboard-balance-dot ${segment.className}`} aria-hidden="true" />
                    {segment.label}
                    <strong>{formatMoney(segment.value)}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="dashboard-scale-note">
              {plannedExpenses > 0
                ? `Доходы за месяц ${formatMoney(plannedExpenses)} — добавьте суммы в бюджет, чтобы увидеть, сколько оплачено`
                : 'Заполните доходы за месяц, чтобы увидеть распределение'}
            </p>
          )}
          <p className="dashboard-scale-note">
            {plannedExpenses <= 0
              ? 'План бюджета не заполнен'
              : `Доходы за месяц ${formatMoney(plannedExpenses)} · оплачено ${formatMoney(paidFromPlan)}`}
          </p>
        </section>

        {recentMonths.length > 1 && (
          <section className="dashboard-scale-group">
            <h2>Динамика дохода</h2>
            <div className="dashboard-trend" role="list" aria-label="Доход по последним месяцам">
              {recentMonths.map((month) => (
                <div className="dashboard-trend-item" role="listitem" key={month.label}>
                  <span className="dashboard-trend-value">{formatMoney(month.value)}</span>
                  <div className="dashboard-trend-track">
                    <div
                      className="dashboard-trend-fill"
                      style={{ height: `${recentMax > 0 ? Math.max((month.value / recentMax) * 100, 4) : 0}%` }}
                    />
                  </div>
                  <span className="dashboard-trend-label">{month.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <section className="dashboard-kpi-grid income-summary-grid" aria-label="Активы и пассивы">
        <h2 className="dashboard-section-title">Активы и пассивы</h2>
        <article className="dashboard-kpi dashboard-kpi-success">
          <span className="dashboard-kpi-label">Активы</span>
          <strong className="dashboard-kpi-value">{formatMoney(totalAssets)}</strong>
        </article>
        <article className={`dashboard-kpi${totalLiabilities < 0 ? ' dashboard-kpi-danger' : ''}`}>
          <span className="dashboard-kpi-label">Пассивы</span>
          <strong className="dashboard-kpi-value">{formatMoney(totalLiabilities)}</strong>
        </article>
      </section>
    </div>
  );
}
