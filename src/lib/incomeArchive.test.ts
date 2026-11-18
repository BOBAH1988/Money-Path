import { describe, expect, it } from 'vitest';
import { getIncomeArchiveMonthWindow, resolveActiveMonth } from './incomeArchive';

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

describe('resolveActiveMonth', () => {
  const row = (year: number, months: number[]) => ({ year, months });

  it('keeps the previous month until the new month has data', () => {
    const rows = [row(2026, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 130320, 0])];
    expect(resolveActiveMonth(rows, new Date(2026, 11, 3))).toEqual({ year: 2026, index: 10 });
  });

  it('switches to the new month as soon as its data appears', () => {
    const rows = [row(2026, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 130320, 150000])];
    expect(resolveActiveMonth(rows, new Date(2026, 11, 12))).toEqual({ year: 2026, index: 11 });
  });

  it('crosses the year boundary with the previous December', () => {
    const rows = [row(2026, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150000])];
    expect(resolveActiveMonth(rows, new Date(2027, 0, 5))).toEqual({ year: 2026, index: 11 });
  });

  it('stays on the current month when the archive is empty', () => {
    expect(resolveActiveMonth([], new Date(2026, 10, 18))).toEqual({ year: 2026, index: 10 });
  });
});
