import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Budget from './Budget';
import { PageTitleContext } from '../components/Layout';

describe('Budget page', () => {
  it('renders without crashing and shows budget sections', () => {
    let pageTitle = '';
    render(
      <PageTitleContext.Provider value={{ pageTitle, setPageTitle: (t: string) => { pageTitle = t; } }}>
        <Budget />
      </PageTitleContext.Provider>
    );
    expect(screen.getByText('Ежемесячные расходы')).toBeInTheDocument();
    expect(screen.getAllByText('Запланированные расходы').length).toBeGreaterThanOrEqual(1);
  });

  it('shows default totals', () => {
    render(
      <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
        <Budget />
      </PageTitleContext.Provider>
    );
    const totals = screen.getAllByText('144 240');
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });
});
