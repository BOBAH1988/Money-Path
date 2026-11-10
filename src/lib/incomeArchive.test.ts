import { describe, expect, it } from 'vitest';
import { getIncomeArchiveMonthWindow } from './incomeArchive';

describe('getIncomeArchiveMonthWindow', () => {
  it('moves continuously across the year boundary', () => {
    expect(getIncomeArchiveMonthWindow(2025 * 12 + 11)).toEqual([
      { year: 2025, index: 11 },
      { year: 2026, index: 0 },
      { year: 2026, index: 1 },
    ]);
  });

  it('keeps months in the new year after crossing December', () => {
    expect(getIncomeArchiveMonthWindow(2026 * 12)).toEqual([
      { year: 2026, index: 0 },
      { year: 2026, index: 1 },
      { year: 2026, index: 2 },
    ]);
  });
});
