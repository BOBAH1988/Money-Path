import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTitleContext } from '../components/PageTitleContext';
import { ToastProvider } from '../ui/Toast';
import { AuthProvider } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { useAuth } from '../context/AuthContext';
import { COLLECTIONS } from '../lib/firestore';

const IncomeArchiveMock = () => {
  const { items, loading, error, addItem, updateItem, removeItem } = useData<{ id: string; name: string; months: number[] }>({
    collectionName: COLLECTIONS.incomeArchive,
    userId: 'uid-123',
  });
  return (
    <div>
      <h2>Доходы архив</h2>
      <div>0</div>
      <button onClick={() => addItem({ id: '1', name: 'Тест', months: [1, 2, 3] })}>Добавить</button>
      <button onClick={() => removeItem('1')}>Удалить</button>
      {loading && <span>загрузка</span>}
      {error && <span>ошибка</span>}
    </div>
  );
};

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

vi.mock('../hooks/useData', () => ({
  useData: vi.fn(),
}));

vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const wrap = () => (
  <ToastProvider>
    <IncomeArchiveMock />
  </ToastProvider>
);

describe('IncomeArchive page', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    (useData as any).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      addItem: () => {},
      updateItem: () => {},
      removeItem: () => {},
    });
    (useAuth as any).mockReturnValue({ uid: 'uid-123', isAuthReady: true, isAuthenticated: true });

    render(wrap());
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('Доходы архив')).toBeInTheDocument();
  });

  it('does not show delete (trash) buttons when no row is in edit mode', async () => {
    render(wrap());
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText('🗑️')).toBeNull();
  });
});
