import { useMemo, useState } from 'react';

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

const YEARS = Array.from({ length: 13 }, (_, i) => 2026 + i);

interface Props {
  /** Начальный год */
  value?: Date;
  /** Обработчик изменения даты */
  onChange: (value: Date) => void;
  /** Опциональный класс */
  className?: string;
}

export const YearMonthPicker = ({ value = new Date(), onChange, className }: Props) => {
  const [year, setYear] = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth());

  const selectedYear = YEARS.includes(year) ? year : YEARS[YEARS.length - 1];
  const selectedMonth = Math.min(Math.max(month, 0), 11);

  const current = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1);
    d.setDate(1);
    return d;
  }, [selectedYear, selectedMonth]);

  const handleYearChange = (next: number) => {
    setYear(next);
    onChange(current);
  };

  const handleMonthChange = (next: number) => {
    setMonth(next);
    onChange(current);
  };

  return (
    <div className={className}>
      <div className="year-month-picker">
        <label className="year-month-picker-label" htmlFor="year-select">
          Год
        </label>
        <select
          id="year-select"
          className="year-month-picker-select"
          value={selectedYear}
          onChange={(e) => handleYearChange(Number(e.target.value))}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <label className="year-month-picker-label" htmlFor="month-select">
          Месяц
        </label>
        <select
          id="month-select"
          className="year-month-picker-select"
          value={selectedMonth}
          onChange={(e) => handleMonthChange(Number(e.target.value))}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
