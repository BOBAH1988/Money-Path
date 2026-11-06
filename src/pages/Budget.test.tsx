import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Budget from './Budget';
import { PageTitleContext } from '../components/Layout';
import { AuthProvider } from '../context/AuthContext';

describe('Budget page', () => {
  it('renders without crashing and shows budget sections', async () => {
    let pageTitle = '';
    render(
      <AuthProvider>
        <PageTitleContext.Provider value={{ pageTitle, setPageTitle: (t: string) => { pageTitle = t; } }}>
          <Budget />
        </PageTitleContext.Provider>
      </AuthProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Ежемесячные расходы')).toBeInTheDocument();
  });

  it('shows default totals without auth', async () => {
    render(
      <AuthProvider>
        <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
          <Budget />
        </PageTitleContext.Provider>
      </AuthProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    // defaultBudgetPlan monthly total = 65400, planned total = 78840
    const monthlyTotal = screen.getAllByText('65 400 ₽');
    expect(monthlyTotal.length).toBeGreaterThanOrEqual(1);
  });
});
