export const ACCOUNT_DELETION_GRACE_DAYS = 7;
export const ACCOUNT_DELETION_GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

const DELETION_STORAGE_KEY = 'denegnyj_put_account_deletion';

export interface ScheduledDeletion {
  uid: string;
  email: string;
  requestedAt: string;
  /** Момент, после которого аккаунт удаляется необратимо. */
  deleteAt: string;
}

const isScheduledDeletion = (value: unknown): value is ScheduledDeletion => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.uid === 'string'
    && typeof record.email === 'string'
    && typeof record.requestedAt === 'string'
    && typeof record.deleteAt === 'string'
    && !Number.isNaN(Date.parse(record.deleteAt));
};

const readStore = (): Record<string, ScheduledDeletion> => {
  try {
    const raw = localStorage.getItem(DELETION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, ScheduledDeletion> = {};
    for (const [uid, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isScheduledDeletion(value)) result[uid] = value;
    }
    return result;
  } catch {
    return {};
  }
};

const writeStore = (store: Record<string, ScheduledDeletion>): void => {
  try {
    localStorage.setItem(DELETION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Хранилище недоступно — отметка живёт только до перезагрузки
  }
};

/** Планирует удаление аккаунта и возвращает дату необратимого удаления. */
export const scheduleAccountDeletion = (
  uid: string,
  email: string,
  now = Date.now(),
): ScheduledDeletion => {
  const record: ScheduledDeletion = {
    uid,
    email,
    requestedAt: new Date(now).toISOString(),
    deleteAt: new Date(now + ACCOUNT_DELETION_GRACE_MS).toISOString(),
  };
  const store = readStore();
  store[uid] = record;
  writeStore(store);
  return record;
};

/** Отменяет запланированное удаление: данные при этом не меняются. */
export const cancelScheduledDeletion = (uid: string): void => {
  const store = readStore();
  if (!(uid in store)) return;
  delete store[uid];
  writeStore(store);
};

export const getScheduledDeletion = (uid?: string): ScheduledDeletion | null => {
  if (!uid) return null;
  return readStore()[uid] ?? null;
};

/** Признак того, что срок истёк и аккаунт нужно удалить при следующем входе. */
export const isDeletionDue = (record: ScheduledDeletion | null, now = Date.now()): boolean =>
  Boolean(record && Date.parse(record.deleteAt) <= now);

export const formatDeletionDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Сколько полных дней осталось до необратимого удаления. */
export const deletionDaysLeft = (record: ScheduledDeletion | null, now = Date.now()): number => {
  if (!record) return 0;
  return Math.max(0, Math.ceil((Date.parse(record.deleteAt) - now) / (24 * 60 * 60 * 1000)));
};
