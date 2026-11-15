import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { ToastProvider } from '../ui/Toast';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { PageTitleProvider } from '../components/PageTitleContext';

vi.mock('../hooks/useData', () => ({
  useData: vi.fn(),
}));

vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AuthContext')>();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const wrap = (component: React.ReactNode) => (
  <ToastProvider>
    <PageTitleProvider>{component}</PageTitleProvider>
  </ToastProvider>
);

describe('IncomeArchive page', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    const IncomeArchive = (await import('../pages/IncomeArchive')).default;
    (useData as any).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      addItem: () => {},
      updateItem: () => {},
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap(<IncomeArchive />));
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Доходы')).toBeInTheDocument();
  });

  it('shows empty state when no income data', async () => {
    const IncomeArchive = (await import('../pages/IncomeArchive')).default;
    (useData as any).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      addItem: () => {},
      updateItem: () => {},
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap(<IncomeArchive />));
    await new Promise((r) => setTimeout(r, 100));
    const els = screen.getAllByText('Источников дохода нет');
    expect(els.length).toBeGreaterThan(0);
  });

  it('opens add form modal when clicking + button', async () => {
    const IncomeArchive = (await import('../pages/IncomeArchive')).default;
    const addItem = vi.fn();
    (useData as any).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      addItem,
      updateItem: () => {},
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap(<IncomeArchive />));
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      fireEvent.click(screen.getAllByLabelText('Добавить источник')[0]);
    });
    await screen.findByText('Новый источник дохода');
  });

  it('opens edit form modal when clicking edit icon', async () => {
    const IncomeArchive = (await import('../pages/IncomeArchive')).default;
    const items = [
      { id: '1', name: 'Зарплата', year: 2026, months: [1000, 2000, 3000, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ];
    (useData as any).mockReturnValue({
      items,
      loading: false,
      error: null,
      addItem: () => {},
      updateItem: () => {},
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap(<IncomeArchive />));
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      fireEvent.click(screen.getByLabelText('Редактировать'));
    });
    await screen.findByText('Редактировать источник');
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });
});
