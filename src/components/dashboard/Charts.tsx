import { useMemo } from 'react';

const getMaxValue = (values: number[]): number => {
  const max = Math.max(...values, 0);
  if (max === 0) return 1;
  const exp = Math.pow(10, String(max).length - 1);
  if (max < exp * 1.5) return exp;
  if (max < exp * 3) return exp * 2;
  if (max < exp * 7) return exp * 3;
  return exp * 10;
};

interface LineChartProps {
  /** Полный массив значений (по каждому месяцу года/серии) */
  data: number[];
  /** Метки для осей X (например, ["Янв.", "Фев.", ...]) */
  labels: string[];
  /** Колонки для подписи ряда, позиция label */
  labelPos?: 'top' | 'bottom';
  /** Опциональные подписи точек */
  suffix?: string;
  /** Цвет фона для фона изолированного ряда */
  accent?: string;
}

export const LineChart = ({
  data,
  labels,
  labelPos = 'top',
  suffix = '',
  accent = '#059669',
}: LineChartProps) => {
  const count = Math.max(data.length, labels.length);
  const normalizedData = useMemo(() => {
    if (data.length === 0) return new Array(count).fill(0);
    return data.slice(0, count);
  }, [data, count]);
  const normalizedLabels = useMemo(() => {
    if (labels.length === 0) return new Array(count).fill('');
    return labels.slice(0, count);
  }, [labels, count]);
  const max = getMaxValue(normalizedData);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    padding: 10,
    border: '1px solid var(--dp-border, #e2e8f0)',
    borderRadius: 12,
    background: 'var(--theme-card, #fff)',
  };

  const gridStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  };

  const trackStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  };

  const lineStyle: React.CSSProperties = {
    height: 4,
    borderRadius: 2,
    background: accent,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--dp-color-text-muted, #64748b)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--dp-color-text, #0f172a)',
    minWidth: 44,
    textAlign: 'right',
  };

  const areaBaseStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    minHeight: 0,
  };

  const seriesStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  };

  const barWidth = Math.max(1, Math.floor(100 / count));

  return (
    <div style={containerStyle}>
      <div style={seriesStyle}>
        <span style={labelStyle}>{normalizedLabels[0]}</span>
        <span style={valueStyle}>{normalizedData[0].toLocaleString('ru-RU')}{suffix}</span>
      </div>
      <div style={gridStyle}>
        {Array.from({ length: count }).map((_, column) => {
          const value = normalizedData[column] ?? 0;
          const ratio = Math.max(Math.min(value / max, 1), 0);
          const height = 4 + Math.round(ratio * 120);
          return (
            <div key={column} style={areaBaseStyle}>
              <div style={{ ...lineStyle, height, width: barWidth }} />
            </div>
          );
        })}
      </div>
      <div style={trackStyle}>
        {normalizedLabels.map((label, column) => (
          <div
            key={column}
            style={{
              ...labelStyle,
              ...(labelPos === 'top' ? { marginBottom: 4 } : { marginTop: 4 }),
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

interface BarChartProps {
  /** Шаблон данных: { labels: string[], values: number[] } */
  series: { labels: string[]; values: number[] }[];
}

export const BarChart = ({ series }: BarChartProps) => {
  const maxValue = Math.max(...series.flatMap((item) => item.values.map(Math.abs)), 0);

  return (
    <div className="dashboard-bar-chart" role="list">
      {series.map((item, index) => {
        const label = item.labels[0] ?? '';
        const value = item.values[0] ?? 0;
        const displayValue = value === 0 ? 0 : value;
        const width = maxValue > 0 ? (Math.abs(value) / maxValue) * 100 : 0;

        return (
          <div className="dashboard-bar-chart-row" key={`${label}-${index}`} role="listitem">
            <div className="dashboard-bar-chart-heading">
              <span>{label}</span>
              <strong>{displayValue.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div
              className="dashboard-bar-chart-track"
              role="progressbar"
              aria-label={label}
              aria-valuenow={Math.abs(value)}
              aria-valuemin={0}
              aria-valuemax={maxValue || 1}
            >
              <div
                className={[
                  'dashboard-bar-chart-fill',
                  value < 0 ? 'dashboard-bar-chart-fill-negative' : index === 0 ? 'dashboard-bar-chart-fill-primary' : '',
                ].filter(Boolean).join(' ')}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface EmptyChartProps {
  title: string;
  description: string;
  /** Дополнительная инструкция или действие */
  action?: React.ReactNode;
  /** Дополнительная иконка */
  icon?: string;
}

export const EmptyChart = ({ title, description, action, icon = '⬜' }: EmptyChartProps) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      border: '1px dashed var(--dp-border, #e2e8f0)',
      borderRadius: 12,
      background: 'var(--theme-surface, #f8fafc)',
    }}
  >
    <span style={{ fontSize: 32, opacity: 0.4 }}>{icon}</span>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dp-color-text-muted, #64748b)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--dp-color-text-muted, #64748b)', lineHeight: 1.4 }}>
        {description}
      </div>
    </div>
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </div>
);
