import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { act } from 'react';
import { ToastProvider } from '../ui/Toast';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { PageTitleProvider } from '../components/PageTitleContext';

afterEach(() => cleanup());

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

  it('«+» сразу добавляет источник «Новый источник» с нулями по месяцам', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Добавить источник' }));
    });

    // Строка появляется сразу, без модалки: название по умолчанию и 12 нулей.
    // (кнопка «+» остаётся на месте; «−» рядом открывает выбор строки)
    expect(addItem).toHaveBeenCalledTimes(1);
    const created = addItem.mock.calls[0][0];
    expect(created.name).toBe('Новый источник');
    expect(created.months).toEqual(new Array(12).fill(0));
    expect(screen.queryByText('Новый источник дохода')).not.toBeInTheDocument();
  });

  it('название правится прямо в ячейке, без модалки', async () => {
    const IncomeArchive = (await import('../pages/IncomeArchive')).default;
    const updateItem = vi.fn();
    const items = [
      { id: '1', name: 'Зарплата', year: 2026, months: [1000, 2000, 3000, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ];
    (useData as any).mockReturnValue({
      items,
      loading: false,
      error: null,
      addItem: () => {},
      updateItem,
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap(<IncomeArchive />));
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Изменить: Зарплата/ }));
    });

    // Модалки нет: на месте названия появляется поле ввода.
    const input = screen.getByLabelText('Название источника');
    fireEvent.change(input, { target: { value: 'Аванс' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateItem).toHaveBeenCalledWith('1', { name: 'Аванс' });
    expect(screen.queryByText('Редактировать источник')).not.toBeInTheDocument();
  });

  it('кнопка «−» открывает выбор источника для удаления', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Удалить источник' }));
    });

    // Появляется список источников, выбор строки ведёт к подтверждению удаления.
    expect(screen.getByRole('heading', { name: 'Удалить источник' })).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Зарплата' }));
    });
    await screen.findByText('Удалить источник?');
  });
});
