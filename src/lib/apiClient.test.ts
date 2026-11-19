import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, type SyncOperation } from './apiClient';

const response = (status: number, body?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

type FetchCall = [string, RequestInit];

const firstCall = (fetchImpl: ReturnType<typeof vi.fn>): FetchCall =>
  (fetchImpl.mock.calls as unknown as FetchCall[])[0]!;

const clientWith = (fetchImpl: typeof fetch, token: string | null = 'token-1') =>
  createApiClient({ baseUrl: 'https://api.example', getToken: async () => token, fetchImpl });

describe('apiClient', () => {
  it('читает коллекцию с Bearer-токеном', async () => {
    const fetchImpl = vi.fn(async () => response(200, { dataVersion: 'v1', items: [{ id: 'a1' }] }));
    const api = clientWith(fetchImpl as unknown as typeof fetch);

    const snapshot = await api.getCollection<{ id: string }>('income');

    expect(snapshot).toEqual({ dataVersion: 'v1', items: [{ id: 'a1' }] });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example/me/collections/income', {
      method: 'GET',
      headers: { 'authorization': 'Bearer token-1', 'accept': 'application/json' },
      body: undefined,
    });
  });

  it('не ходит в сеть без токена', async () => {
    const fetchImpl = vi.fn();
    const api = clientWith(fetchImpl as unknown as typeof fetch, null);

    await expect(api.getCollection('income')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('прокидывает код и сообщение ошибки сервера', async () => {
    const fetchImpl = vi.fn(async () =>
      response(422, { code: 'VALIDATION_ERROR', message: 'Некорректная запись' }),
    );
    const api = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(api.putItem('income', { id: 'a1' })).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Некорректная запись',
    });
  });

  it('возвращает undefined на 204', async () => {
    const fetchImpl = vi.fn(async () => response(204));
    const api = clientWith(fetchImpl as unknown as typeof fetch);

    await expect(api.deleteItem('income', 'a1')).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example/me/collections/income/a1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('экранирует id в пути', async () => {
    const fetchImpl = vi.fn(async () => response(204));
    const api = clientWith(fetchImpl as unknown as typeof fetch);

    await api.putItem('assets', { id: 'a/1 b' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example/me/collections/assets/a%2F1%20b',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('отправляет пакет операций sync', async () => {
    const fetchImpl = vi.fn(async () => response(200, { dataVersion: 'v2', applied: [] }));
    const api = clientWith(fetchImpl as unknown as typeof fetch);

    const operations: SyncOperation[] = [
      { op: 'upsert', operationId: 'o1', collection: 'income', item: { id: 'r1', amount: 5 } },
      { op: 'clear', operationId: 'o2', collection: 'assets' },
    ];
    await api.sync('tab-1', operations);

    const [, init] = firstCall(fetchImpl);
    expect(init.body).toBe(JSON.stringify({ clientId: 'tab-1', operations }));
  });

  it('не оставляет двойной слэш при завершающем слэше в baseUrl', async () => {
    const fetchImpl = vi.fn(async () => response(200, { items: [] }));
    const api = createApiClient({
      baseUrl: 'https://api.example/',
      getToken: async () => 'token-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await api.getCollection('income');

    expect(firstCall(fetchImpl)[0]).toBe('https://api.example/me/collections/income');
  });
});
