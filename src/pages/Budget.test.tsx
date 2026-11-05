import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Budget from './Budget';

describe('Budget page', () => {
  it('renders without crashing and shows budget sections', () => {
    render(<Budget />);
    expect(screen.getByText('Планирование бюджета')).toBeInTheDocument();
    expect(screen.getByText('Ежемесячные расходы')).toBeInTheDocument();
    // 'Запланированные расходы' встречается 3 раза (заголовок, строка, итог) — берем любой
    expect(screen.getAllByText('Запланированные расходы').length).toBeGreaterThanOrEqual(1);
  });

  it('shows default totals', () => {
    render(<Budget />);
    // '144 240' встречается дважды (строка итога и итог карточки), берем любой
    const totals = screen.getAllByText('144 240');
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });
});