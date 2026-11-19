export interface ItemRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export interface ArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const idOf = (raw: Record<string, unknown>): string | null => {
  const id = raw.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
};

/** Повторяет форму строки активов/пассивов/доходов, которую пишет клиент. */
export const toItemRow = (raw: Record<string, unknown>): ItemRow | null => {
  const id = idOf(raw);
  if (!id) return null;
  return {
    id,
    name: str(raw.name),
    amount: num(raw.amount),
    monthly: num(raw.monthly),
  };
};

/**
 * Повторяет migrateArchiveRow из src/pages/Dashboard.tsx: у legacy-записей
 * months нет, а amount/monthly лежат первыми двумя месяцами.
 */
export const toArchiveRow = (
  raw: Record<string, unknown>,
  now: Date = new Date(),
): ArchiveRow | null => {
  const id = idOf(raw);
  if (!id) return null;

  const year = typeof raw.year === 'number' && Number.isFinite(raw.year) ? raw.year : now.getFullYear();

  if (Array.isArray(raw.months) && raw.months.length === 12) {
    return {
      id,
      name: str(raw.name),
      year,
      months: raw.months.map((value) => num(value)),
    };
  }

  const months = new Array<number>(12).fill(0);
  if (typeof raw.amount === 'number') months[0] = raw.amount;
  if (typeof raw.monthly === 'number') months[1] = raw.monthly;
  return { id, name: str(raw.name), year, months };
};
