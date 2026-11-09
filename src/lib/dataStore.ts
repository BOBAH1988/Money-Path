export const COLLECTIONS = {
  assets: 'assets',
  liabilities: 'liabilities',
  income: 'income',
  incomeArchive: 'income_archive',
  budgetPlan: 'budget_plan',
  users: 'users',
} as const;

export type FirestoreCollection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const ALL_COLLECTIONS: FirestoreCollection[] = [
  COLLECTIONS.assets,
  COLLECTIONS.liabilities,
  COLLECTIONS.income,
  COLLECTIONS.incomeArchive,
  COLLECTIONS.budgetPlan,
];

export const colPath = (collectionName: string, userId?: string) =>
  userId ? `users/${userId}/${collectionName}` : collectionName;

export const storageKeyFor = (collectionName: string, userId?: string) =>
  userId ? `denegnyj_put_${userId}_${collectionName}` : `denegnyj_put_${collectionName}`;

export const loadLocalCollection = <T extends { id: string }>(collectionName: string, userId?: string): T[] => {
  try {
    const raw = localStorage.getItem(storageKeyFor(collectionName, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export const saveLocalCollection = <T extends { id: string }>(collectionName: string, items: T[], userId?: string) => {
  try {
    localStorage.setItem(storageKeyFor(collectionName, userId), JSON.stringify(items));
  } catch {
    // ignore
  }
};

export const budgetLocalKeys = (userId?: string): string[] => {
  if (!userId) return [storageKeyFor(COLLECTIONS.budgetPlan), 'denegnyj_put_budget_plan'];
  return [
    storageKeyFor(COLLECTIONS.budgetPlan, userId),
    `denegnyj_put_budget_plan_${userId}`,
  ];
};

export const loadLocalBudgetPlan = (userId?: string): { items: unknown[]; updatedAt: string } => {
  for (const key of budgetLocalKeys(userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { items?: unknown[]; updatedAt?: string } | unknown[];
      if (Array.isArray(parsed)) return { items: parsed, updatedAt: '' };
      if (parsed && Array.isArray(parsed.items)) {
        return { items: parsed.items, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '' };
      }
    } catch {
      // ignore
    }
  }
  return { items: [], updatedAt: '' };
};

export const saveLocalBudgetPlan = (items: unknown[], updatedAt: string, userId?: string) => {
  const payload = JSON.stringify({ items, updatedAt });
  for (const key of budgetLocalKeys(userId)) {
    try {
      localStorage.setItem(key, payload);
    } catch {
      // ignore
    }
  }
};

export const isResetPending = (): boolean => {
  try {
    const v = localStorage.getItem('denegnyj_put_reset_pending');
    return v !== null && v !== '';
  } catch {
    return false;
  }
};

export const getResetPendingUserId = (): string | undefined => {
  try {
    const v = localStorage.getItem('denegnyj_put_reset_pending');
    if (v === null) return undefined;
    return v === '' ? undefined : v;
  } catch {
    return undefined;
  }
};

export const clearResetPending = () => {
  try {
    localStorage.removeItem('denegnyj_put_reset_pending');
  } catch {
    // ignore
  }
};

export const clearCollectionData = (collectionName: string, userId?: string): void => {
  try {
    localStorage.removeItem(storageKeyFor(collectionName, userId));
    localStorage.removeItem(storageKeyFor(collectionName, undefined));
    if (collectionName === COLLECTIONS.budgetPlan) {
      localStorage.removeItem('denegnyj_put_budget_plan');
      if (userId) localStorage.removeItem(`denegnyj_put_budget_plan_${userId}`);
    }
  } catch {
    // ignore
  }
};
