export interface IncomeArchiveMonth {
  year: number;
  index: number;
}

export const getIncomeArchiveMonthWindow = (start: number): IncomeArchiveMonth[] =>
  Array.from({ length: 3 }, (_, offset) => {
    const absoluteMonth = start + offset;
    return {
      year: Math.floor(absoluteMonth / 12),
      index: ((absoluteMonth % 12) + 12) % 12,
    };
  });
