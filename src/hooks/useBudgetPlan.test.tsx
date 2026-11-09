import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBudgetPlan } from './useBudgetPlan';
import { useAuth } from '../context/AuthContext';
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

describe('useBudgetPlan', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns empty plan when no data', async () => {
    const { result } = renderHook(() => useBudgetPlan(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('adds item to plan', async () => {
    const { result } = renderHook(() => useBudgetPlan(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 50));

    act(() => {
      result.current.addItem({ id: '1', name: 'Тест', amount: 100, plan: 50, group: 'monthly', type: 'item' } as never);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe('Тест');
  });

  it('removes item from plan', async () => {
    const { result } = renderHook(() => useBudgetPlan(), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 50));

    act(() => {
      result.current.addItem({ id: '1', name: 'Тест', amount: 100, plan: 50, group: 'monthly', type: 'item' } as never);
      result.current.addItem({ id: '2', name: 'Второй', amount: 50, plan: 25, group: 'planned', type: 'item' } as never);
    });

    const [first] = result.current.items;
    act(() => {
      result.current.removeItem(first.id);
    });

    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].name).toBe('Второй');
  });
});
