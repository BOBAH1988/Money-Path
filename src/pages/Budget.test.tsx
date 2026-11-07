import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Budget from './Budget';
import { PageTitleContext } from '../components/PageTitleContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../ui/Toast';

describe('Budget page', () => {
  it('renders table structure when no items', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
            <Budget />
          </PageTitleContext.Provider>
        </AuthProvider>
      </ToastProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Ежемесячные расходы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить строку' })).toBeInTheDocument();
  });

  it('renders without crashing', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
            <Budget />
          </PageTitleContext.Provider>
        </AuthProvider>
      </ToastProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getAllByText('Общее итого').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0 ₽').length).toBeGreaterThanOrEqual(1);
  });
});
