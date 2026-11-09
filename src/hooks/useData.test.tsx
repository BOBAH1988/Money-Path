import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useData } from './useData';
import { COLLECTIONS } from '../lib/firestore';
import { ToastProvider } from '../ui/Toast';
import { AuthProvider } from '../context/AuthContext';

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

const wrap = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <AuthProvider>{children}</AuthProvider>
  </ToastProvider>
);

interface AssetRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

describe('useData', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns empty items when Firestore returns nothing', async () => {
    const { result } = renderHook(() =>
      useData<AssetRow>({
        collectionName: COLLECTIONS.assets,
        userId: 'uid-123',
      }),
      { wrapper: wrap }
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('adds item to state', async () => {
    const { result } = renderHook(() =>
      useData<AssetRow>({
        collectionName: COLLECTIONS.assets,
        userId: 'uid-123',
      }),
      { wrapper: wrap }
    );

    await new Promise((r) => setTimeout(r, 50));

    act(() => {
      result.current.addItem({ name: 'Вклад', amount: 1000, monthly: 50 });
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe('Вклад');
  });

  it('removes item from state', async () => {
    const { result } = renderHook(() =>
      useData<AssetRow>({
        collectionName: COLLECTIONS.assets,
        userId: 'uid-123',
      }),
      { wrapper: wrap }
    );

    await new Promise((r) => setTimeout(r, 50));

    act(() => {
      result.current.addItem({ name: 'Вклад', amount: 1000, monthly: 50 });
      result.current.addItem({ name: 'Инвестиции', amount: 2000, monthly: 100 });
    });

    const [first] = result.current.items;
    act(() => {
      result.current.removeItem(first.id);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe('Инвестиции');
  });
});
