import { useMemo, useState } from 'react';

export interface IncomeArchiveChartRow {
  year: number;
  months: number[];
}

const MONTHS = [
  'Янв.', 'Фев.', 'Март', 'Апр.', 'Май', 'Июн.',
  'Июл.', 'Авг.', 'Сент.', 'Окт.', 'Нояб.', 'Дек.',
];

interface IncomeArchiveChartProps {
  rows: readonly IncomeArchiveChartRow[];
}

export const IncomeArchiveChart = ({ rows }: IncomeArchiveChartProps) => {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const years = useMemo(
    () =>
      [...new Set(rows.filter((row) => row.months.some((v) => v !== 0)).map((row) => row.year))]
        .sort((a, b) => b - a),
    [rows],
  );

  const activeYear = year !== null && years.includes(year) ? year : years[0];

  const stats = useMemo(() => {
    const totals = new Array(12).fill(0);
    rows
      .filter((row) => row.year === activeYear)
      .forEach((row) => {
        row.months.forEach((value, index) => {
          if (value) totals[index] += value;
        });
      });
    const filled = totals.filter((value) => value !== 0);
    const total = totals.reduce((sum, value) => sum + value, 0);
    return {
      totals,
      total,
      average: filled.length > 0 ? Math.round(total / filled.length) : 0,
      max: Math.max(...totals, 0),
      best: totals.indexOf(Math.max(...totals)),
      filledMonths: filled.length,
    };
  }, [rows, activeYear]);

  if (years.length === 0) return null;

  const { totals, total, average, max, best, filledMonths } = stats;

  return (
    <section className="budget-card income-archive-chart">
      <div className="budget-card-header">
        <button
          type="button"
          className="income-archive-chart-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="income-archive-chart-body"
        >
          <span
            className={`income-archive-chart-chevron${open ? ' income-archive-chart-chevron-open' : ''}`}
            aria-hidden="true"
          >
            ▸
          </span>
          <h2 className="budget-card-title" style={{ margin: 0 }}>Архив доходов</h2>
        </button>
        {open && (
          <select
            className="income-archive-chart-year"
            aria-label="Год архива доходов"
            value={activeYear}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        )}
      </div>
      {open && (
        <div className="budget-card-body income-archive-chart-body" id="income-archive-chart-body">
          <ul className="income-archive-stats">
            <li>
              <span className="income-archive-stat-label">За год</span>
              <strong className="income-archive-stat-value">
                {total.toLocaleString('ru-RU')} ₽
              </strong>
            </li>
            <li>
              <span className="income-archive-stat-label">В среднем в месяц</span>
              <strong className="income-archive-stat-value">
                {average.toLocaleString('ru-RU')} ₽
              </strong>
            </li>
            <li>
              <span className="income-archive-stat-label">Лучший месяц</span>
              <strong className="income-archive-stat-value">
                {max > 0 ? `${MONTHS[best]} · ${max.toLocaleString('ru-RU')} ₽` : '—'}
              </strong>
            </li>
          </ul>

          <div className="income-archive-bars" role="list" aria-label="Доход по месяцам года">
            {totals.map((value, index) => (
              <div className="income-archive-bar-item" role="listitem" key={MONTHS[index]}>
                <span className="income-archive-bar-value">
                  {value ? `${Math.round(value / 1000)}k` : '—'}
                </span>
                <div className="income-archive-bar-track">
                  <div
                    className={`income-archive-bar-fill${value === 0 ? ' income-archive-bar-fill-empty' : ''}`}
                    style={{ height: `${max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0}%` }}
                    title={`${MONTHS[index]}: ${value.toLocaleString('ru-RU')} ₽`}
                  />
                </div>
                <span className="income-archive-bar-label">{MONTHS[index].replace('.', '')}</span>
              </div>
            ))}
          </div>

          <p className="income-archive-note">
            Заполнено месяцев: {filledMonths} из 12 · год {activeYear}
          </p>
        </div>
      )}
    </section>
  );
};
