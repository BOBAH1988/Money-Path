import { describe, expect, it } from 'vitest';
import { readBackendConfig } from './backend';

describe('readBackendConfig', () => {
  it('по умолчанию остаётся на firebase', () => {
    expect(readBackendConfig({})).toEqual({ backend: 'firebase', apiUrl: '' });
  });

  it('включает api только при заданных флаге и URL', () => {
    expect(readBackendConfig({ VITE_DATA_BACKEND: 'api', VITE_API_URL: 'https://api.example' })).toEqual({
      backend: 'api',
      apiUrl: 'https://api.example',
    });
  });

  it('не переключается, если URL не задан', () => {
    expect(readBackendConfig({ VITE_DATA_BACKEND: 'api' }).backend).toBe('firebase');
  });

  it('игнорирует неизвестное значение флага', () => {
    expect(readBackendConfig({ VITE_DATA_BACKEND: 'server', VITE_API_URL: 'https://api.example' }).backend).toBe(
      'firebase',
    );
  });

  it('нормализует флаг и убирает завершающий слэш', () => {
    expect(
      readBackendConfig({ VITE_DATA_BACKEND: ' API ', VITE_API_URL: ' https://api.example/// ' }),
    ).toEqual({ backend: 'api', apiUrl: 'https://api.example' });
  });
});
