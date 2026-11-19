export type DataBackend = 'firebase' | 'api';

export interface BackendConfig {
  /** Какой транспорт данных использовать. По умолчанию — firebase. */
  backend: DataBackend;
  /** Базовый URL API без завершающего слэша. */
  apiUrl: string;
}

type EnvLike = Record<string, string | undefined>;

const normalizeUrl = (value: string | undefined): string => (value ?? '').trim().replace(/\/+$/, '');

/**
 * Флаг переключения транспорта. `api` включается только когда одновременно заданы
 * VITE_DATA_BACKEND=api и VITE_API_URL — иначе приложение молча остаётся на firebase.
 */
export const readBackendConfig = (env: EnvLike): BackendConfig => {
  const requested = (env.VITE_DATA_BACKEND ?? '').trim().toLowerCase();
  const apiUrl = normalizeUrl(env.VITE_API_URL);
  const backend: DataBackend = requested === 'api' && apiUrl ? 'api' : 'firebase';
  return { backend, apiUrl };
};

export const BACKEND_CONFIG: BackendConfig = readBackendConfig(
  typeof import.meta.env === 'undefined' ? {} : (import.meta.env as EnvLike),
);

export const isApiBackend = (): boolean => BACKEND_CONFIG.backend === 'api';
