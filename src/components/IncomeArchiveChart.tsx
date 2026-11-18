import { useMemo, useState } from 'react';
import { BarChart } from './dashboard/Charts';

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

  if (years.length === 0) return null;

  const activeYear = year !== null && years.includes(year) ? year : years[0];

  const yearRows = rows.filter((row) => row.year === activeYear);
  const monthlyTotals = new Array(12).fill(0);
  yearRows.forEach((row) => {
    row.months.forEach((value, index) => {
      if (value) monthlyTotals[index] += value;
    });
  });
  const filledMonths = monthlyTotals.filter((value) => value !== 0).length;
  const averageIncome = filledMonths > 0
    ? Math.round(monthlyTotals.reduce((sum, value) => sum + value, 0) / filledMonths)
    : 0;

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
          <span className={`income-archive-chart-chevron${open ? ' income-archive-chart-chevron-open' : ''}`} aria-hidden="true">
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
        <div className="budget-card-body" id="income-archive-chart-body">
          <BarChart
            series={[
              { labels: ['Средний доход за год'], values: [averageIncome] },
              ...MONTHS.map((month, index) => ({
                labels: [month],
                values: [monthlyTotals[index] ?? 0],
              })),
            ]}
          />
        </div>
      )}
    </section>
  );
};
