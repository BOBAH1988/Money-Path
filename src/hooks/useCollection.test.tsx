import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollection } from './useCollection';
import { COLLECTIONS } from '../lib/firestore';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../ui/Toast';

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

interface TestItem {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

describe('useCollection', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the only item (previously it was only cleared, not removed)', async () => {
    const { result } = renderHook(() =>
      useCollection<TestItem>({
        collectionName: COLLECTIONS.assets,
        userId: undefined,
      }),
      { wrapper: wrap }
    );
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      result.current.addItem({ name: 'Вклад', amount: 1000, monthly: 50 });
    });

    const item = result.current.items[0];
    act(() => {
      result.current.removeItem(item.id);
    });

    expect(result.current.items.length).toBe(0);
    expect(result.current.items.some((i) => i.id === item.id)).toBe(false);
  });

  it('removes one item from multiple items', async () => {
    const { result } = renderHook(() =>
      useCollection<TestItem>({
        collectionName: COLLECTIONS.assets,
        userId: undefined,
      }),
      { wrapper: wrap }
    );
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      result.current.addItem({ name: 'Вклад', amount: 1000, monthly: 50 });
      result.current.addItem({ name: 'Инвестиции', amount: 2000, monthly: 100 });
    });

    const [first] = result.current.items;
    act(() => {
      result.current.removeItem(first.id);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items.some((i) => i.id === first.id)).toBe(false);
    expect(result.current.items[0].name).toBe('Инвестиции');
  });
});
