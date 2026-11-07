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
  /** Смещение по оси X для каждой серии */
  xOffset?: number[];
  /** Смещение по оси Y (обратное) для каждой серии */
  yOffset?: number[];
}

export const BarChart = ({ series, xOffset, yOffset }: BarChartProps) => {
  const max = useMemo(() => {
    const values = series.flatMap((s) => s.values);
    return getMaxValue(values);
  }, [series]);

  const chartHeight = 110;
  const rows = 13;
  const rowHeight = chartHeight / rows;

  const computeRowHeight = (value: number): number => {
    const ratio = Math.max(Math.min(value / max, 1), 0);
    return Math.max(ratio * (rowHeight - 2), 2);
  };

  const xOffsets = xOffset ?? series.map(() => 0);
  const yOffsets = yOffset ?? series.map(() => 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        border: '1px solid var(--dp-border, #e2e8f0)',
        borderRadius: 12,
        background: 'var(--theme-card, #fff)',
      }}
    >
      {series.map((s, sIndex) => (
        <div key={sIndex} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dp-color-text-muted, #64748b)', minWidth: 60, whiteSpace: 'nowrap' }}>
            {s.labels[0]}
          </span>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
            }}
          >
            {s.values.map((value, vIndex) => {
              const row = rows - Math.min(Math.ceil(vIndex / 4) + 1, rows);
              const height = computeRowHeight(value);
              return (
                <div
                  key={vIndex}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 4,
                    paddingBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--dp-color-text-muted, #64748b)',
                      minWidth: 28,
                      textAlign: 'right',
                    }}
                  >
                    {s.labels[vIndex]}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: ['#059669', '#2563eb', '#d97706'][sIndex % 3],
                      }}
                    />
                    <div
                      style={{
                        width: 14,
                        height: height,
                        borderRadius: 2,
                        background: 'var(--dp-color-success, #059669)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--dp-color-text, #0f172a)',
                        minWidth: 44,
                        textAlign: 'right',
                      }}
                    >
                      {value.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--dp-color-text-muted, #64748b)',
                      minWidth: 32,
                      textAlign: 'right',
                      paddingLeft: 4,
                    }}
                  >
                    {s.values[vIndex]?.toLocaleString('ru-RU') ?? ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
