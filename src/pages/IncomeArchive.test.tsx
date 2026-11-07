import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IncomeArchive from './IncomeArchive';
import { PageTitleContext } from '../components/Layout';
import { AuthProvider } from '../context/AuthContext';

describe('IncomeArchive page', () => {
  it('renders without crashing', async () => {
    render(
      <AuthProvider>
        <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
          <IncomeArchive />
        </PageTitleContext.Provider>
      </AuthProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Доходы архив')).toBeInTheDocument();
  });

  it('does not show delete (trash) buttons when no row is in edit mode', async () => {
    render(
      <AuthProvider>
        <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
          <IncomeArchive />
        </PageTitleContext.Provider>
      </AuthProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    // trash icon should not be present in default (non-edit) state
    expect(screen.queryByText('🗑️')).toBeNull();
  });
});