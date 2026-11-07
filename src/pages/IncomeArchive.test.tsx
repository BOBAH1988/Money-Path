import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IncomeArchive from './IncomeArchive';
import { PageTitleContext } from '../components/PageTitleContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../ui/Toast';

describe('IncomeArchive page', () => {
  it('renders without crashing', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
            <IncomeArchive />
          </PageTitleContext.Provider>
        </AuthProvider>
      </ToastProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Доходы архив')).toBeInTheDocument();
  });

  it('does not show delete (trash) buttons when no row is in edit mode', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
            <IncomeArchive />
          </PageTitleContext.Provider>
        </AuthProvider>
      </ToastProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    // trash icon should not be present in default (non-edit) state
    expect(screen.queryByText('🗑️')).toBeNull();
  });
});