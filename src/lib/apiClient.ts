export type ApiCollection = 'assets' | 'liabilities' | 'income' | 'income_archive';

export interface BudgetPlanPayload {
  items: unknown[];
  updatedAt: string;
}

export interface ProfilePayload {
  uid: string;
  email: string;
  createdAt: string;
  lastActive: string;
  avatar: string | null;
}

export interface ProfileInput {
  email?: string;
  avatar?: string | null;
}

/** Админская аналитика: только агрегаты, без идентификаторов и почт. */
export interface AdminStats {
  total: number;
  active30: number;
  new30: number;
  new7: number;
}

export interface CollectionSnapshot<T> {
  dataVersion: string;
  items: T[];
}

export type SyncOperation =
  | {
      op: 'upsert';
      operationId?: string;
      collection: ApiCollection;
      item: { id: string; [key: string]: unknown };
    }
  | { op: 'delete'; operationId?: string; collection: ApiCollection; itemId: string }
  | { op: 'clear'; operationId?: string; collection: ApiCollection }
  | { op: 'budget_plan'; operationId?: string; items: unknown[]; updatedAt?: string };

export interface SyncResult {
  dataVersion: string;
  applied: { operationId: string; status: 'ok' | 'duplicate' | 'error' }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Возвращает Firebase ID-token текущей сессии или null. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  getCollection: <T extends { id: string }>(collection: ApiCollection) => Promise<CollectionSnapshot<T>>;
  putItem: (collection: ApiCollection, item: { id: string; [key: string]: unknown }) => Promise<void>;
  deleteItem: (collection: ApiCollection, id: string) => Promise<void>;
  clearCollection: (collection: ApiCollection) => Promise<void>;
  getBudgetPlan: () => Promise<BudgetPlanPayload>;
  putBudgetPlan: (plan: BudgetPlanPayload) => Promise<void>;
  sync: (clientId: string, operations: SyncOperation[]) => Promise<SyncResult>;
  deleteAccount: () => Promise<void>;
  getProfile: () => Promise<ProfilePayload>;
  putProfile: (input: ProfileInput) => Promise<void>;
  getAdminStats: () => Promise<AdminStats>;
}

const parseBody = (text: string): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const createApiClient = ({ baseUrl, getToken, fetchImpl = fetch }: ApiClientOptions): ApiClient => {
  const base = baseUrl.replace(/\/+$/, '');

  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const token = await getToken();
    if (!token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Нет активной сессии');
    }

    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return undefined as T;

    const payload = parseBody(await response.text());
    if (!response.ok) {
      const error = payload as { code?: string; message?: string } | null;
      throw new ApiError(
        response.status,
        error?.code ?? 'INTERNAL',
        error?.message ?? `Ошибка сервера (${response.status})`,
      );
    }
    return payload as T;
  };

  return {
    getCollection: <T extends { id: string }>(collection: ApiCollection) =>
      request<CollectionSnapshot<T>>('GET', `/me/collections/${collection}`),

    putItem: (collection, item) =>
      request<void>('PUT', `/me/collections/${collection}/${encodeURIComponent(item.id)}`, item),

    deleteItem: (collection, id) =>
      request<void>('DELETE', `/me/collections/${collection}/${encodeURIComponent(id)}`),

    clearCollection: (collection) => request<void>('DELETE', `/me/collections/${collection}`),

    getBudgetPlan: () => request<BudgetPlanPayload>('GET', '/me/budget_plan'),

    putBudgetPlan: (plan) => request<void>('PUT', '/me/budget_plan', plan),

    sync: (clientId, operations) => request<SyncResult>('POST', '/me/sync', { clientId, operations }),

    deleteAccount: () => request<void>('DELETE', '/me'),

    getProfile: () => request<ProfilePayload>('GET', '/me/profile'),

    putProfile: (input) => request<void>('PUT', '/me/profile', input),

    getAdminStats: () => request<AdminStats>('GET', '/admin/stats'),
  };
};
