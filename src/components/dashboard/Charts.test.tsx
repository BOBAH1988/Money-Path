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
});
