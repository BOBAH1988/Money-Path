import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from './Charts';

describe('BarChart', () => {
  it('renders each series once with proportional horizontal bars', () => {
    render(
      <BarChart
        series={[
          { labels: ['Расходы'], values: [1000] },
          { labels: ['Регулярные'], values: [400] },
        ]}
      />,
    );

    expect(screen.getAllByText('Расходы')).toHaveLength(1);
    expect(screen.getAllByText('Регулярные')).toHaveLength(1);
    expect(screen.getByText(/1\s*000\s*₽/)).toBeInTheDocument();
    expect(screen.getByText(/400\s*₽/)).toBeInTheDocument();

    const bars = screen.getAllByRole('progressbar');
    expect(bars[0].firstElementChild).toHaveStyle({ width: '100%' });
    expect(bars[1].firstElementChild).toHaveStyle({ width: '40%' });
  });

  it('renders negative values with a proportional bar and keeps the sign in the value', () => {
    render(
      <BarChart
        series={[
          { labels: ['Активы'], values: [1000] },
          { labels: ['Пассивы'], values: [-400] },
        ]}
      />,
    );

    expect(screen.getByText(/-400\s*₽/)).toBeInTheDocument();
    const liabilitiesBar = screen.getByRole('progressbar', { name: 'Пассивы' }).firstElementChild;
    expect(liabilitiesBar).toHaveClass('dashboard-bar-chart-fill-negative');
    expect(liabilitiesBar).toHaveStyle({ width: '40%' });
  });

  it('renders negative zero as zero without a negative color', () => {
    render(<BarChart series={[{ labels: ['Пассивы'], values: [-0] }]} />);

    expect(screen.getByText('0 ₽')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar', { name: 'Пассивы' })[1].firstElementChild)
      .not.toHaveClass('dashboard-bar-chart-fill-negative');
  });
});
