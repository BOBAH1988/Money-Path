export type DataBackend = 'firebase' | 'api';

export interface BackendConfig {
  /** Какой транспорт данных использовать. По умолчанию — firebase. */
  backend: DataBackend;
  /** Базовый URL API без завершающего слэша. */
  apiUrl: string;
  /** Теневые чтения из API при работе на firebase — для сверки перед переключением. */
  shadow: boolean;
  /** Дублировать записи в API при работе на firebase. Опасный режим, по умолчанию выключен. */
  dualWrite: boolean;
}

type EnvLike = Record<string, string | undefined>;

const normalizeUrl = (value: string | undefined): string => (value ?? '').trim().replace(/\/+$/, '');

const isOn = (value: string | undefined): boolean => {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
};

/**
 * Флаг переключения транспорта. `api` включается только когда одновременно заданы
 * VITE_DATA_BACKEND=api и VITE_API_URL — иначе приложение молча остаётся на firebase.
 * Теневые чтения и двусторонняя запись работают только при заданном API и на firebase.
 */
export const readBackendConfig = (env: EnvLike): BackendConfig => {
  const requested = (env.VITE_DATA_BACKEND ?? '').trim().toLowerCase();
  const apiUrl = normalizeUrl(env.VITE_API_URL);
  const backend: DataBackend = requested === 'api' && apiUrl ? 'api' : 'firebase';
  const apiReady = apiUrl.length > 0 && backend === 'firebase';

  return {
    backend,
    apiUrl,
    shadow: apiReady && isOn(env.VITE_SHADOW_API),
    dualWrite: apiReady && isOn(env.VITE_DUAL_WRITE),
  };
};

export const BACKEND_CONFIG: BackendConfig = readBackendConfig(
  typeof import.meta.env === 'undefined' ? {} : (import.meta.env as EnvLike),
);

export const isApiBackend = (): boolean => BACKEND_CONFIG.backend === 'api';
