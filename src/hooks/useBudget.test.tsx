import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBudget } from './useBudget';
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
  <AuthProvider>{children}</AuthProvider>
);

describe('useBudget', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns empty plan without auth', async () => {
    const { result } = renderHook(() => useBudget(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.items.length).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('adds new item without auth (in-memory)', async () => {
    const { result } = renderHook(() => useBudget(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      result.current.addItem('monthly', 'Тестовая строка', 123);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items.some((i) => i.name === 'Тестовая строка')).toBe(true);
  });

  it('updates item amount without auth (in-memory)', async () => {
    const { result } = renderHook(() => useBudget(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      result.current.addItem('monthly', 'Тест', 100);
    });

    const item = result.current.items[0];
    act(() => {
      result.current.updateItem(item.id, { amount: 9999 });
    });

    const updated = result.current.items.find((i) => i.id === item.id);
    expect(updated?.amount).toBe(9999);
  });

  it('removes item without auth (in-memory)', async () => {
    const { result } = renderHook(() => useBudget(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 100));

    act(() => {
      result.current.addItem('monthly', 'Тест', 100);
    });

    const item = result.current.items[0];
    act(() => {
      result.current.removeItem(item.id);
    });

    expect(result.current.items.some((i) => i.id === item.id)).toBe(false);
  });

  it('reset returns empty without auth', async () => {
    const { result } = renderHook(() => useBudget(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 100));

    await result.current.reset();

    expect(result.current.items.length).toBe(0);
  });
});
