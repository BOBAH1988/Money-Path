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

export interface IncomeArchiveRowLike {
  year: number;
  months: number[];
}

/**
 * Выбирает месяц, чьи данные считать «текущими».
 *
 * Смена месяца привязана к появлению данных следующего месяца в архиве, а не
 * к календарному 1-му числу: зарплата обычно приходит около 12-го, и до этого
 * карточка должна показывать прошлый месяц, а не нули.
 */
export const resolveActiveMonth = (
  rows: readonly IncomeArchiveRowLike[],
  now: Date = new Date(),
): IncomeArchiveMonth => {
  const current: IncomeArchiveMonth = { year: now.getFullYear(), index: now.getMonth() };
  let active = current;
  for (let step = 0; step < 12; step += 1) {
    const absolute = active.year * 12 + active.index;
    const previous = absolute - 1;
    const candidate: IncomeArchiveMonth = {
      year: Math.floor(previous / 12),
      index: ((previous % 12) + 12) % 12,
    };
    const hasCurrentData = rows.some(
      (row) => row.year === active.year && (row.months[active.index] || 0) !== 0,
    );
    if (hasCurrentData) break;
    const hasPreviousData = rows.some(
      (row) => row.year === candidate.year && (row.months[candidate.index] || 0) !== 0,
    );
    if (!hasPreviousData) break;
    active = candidate;
  }
  return active;
};
