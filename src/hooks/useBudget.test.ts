import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBudget } from './useBudget';

// Мокаем localStorage
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

describe('useBudget', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('loads default plan when localStorage is empty', () => {
    const { result } = renderHook(() => useBudget());
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.items.some((i) => i.name === 'Ипотека')).toBe(true);
  });

  it('updates item amount and saves to localStorage', () => {
    const { result } = renderHook(() => useBudget());
    const item = result.current.items.find((i) => i.name === 'Ипотека')!;

    act(() => {
      result.current.updateItem(item.id, { amount: 9999 });
    });

    const updated = result.current.items.find((i) => i.id === item.id);
    expect(updated?.amount).toBe(9999);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('adds new item', () => {
    const { result } = renderHook(() => useBudget());
    const beforeCount = result.current.items.length;

    act(() => {
      result.current.addItem('monthly', 'Тестовая строка', 123);
    });

    expect(result.current.items.length).toBe(beforeCount + 1);
    expect(result.current.items.some((i) => i.name === 'Тестовая строка')).toBe(true);
  });

  it('removes item', () => {
    const { result } = renderHook(() => useBudget());
    const item = result.current.items.find((i) => i.name === 'Ипотека')!;

    act(() => {
      result.current.removeItem(item.id);
    });

    expect(result.current.items.some((i) => i.id === item.id)).toBe(false);
  });
});