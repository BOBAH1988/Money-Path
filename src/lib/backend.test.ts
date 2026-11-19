import { describe, expect, it } from 'vitest';
import { readBackendConfig } from './backend';

const base = { backend: 'firebase', apiUrl: '', shadow: false, dualWrite: false };

describe('readBackendConfig', () => {
  it('по умолчанию остаётся на firebase', () => {
    expect(readBackendConfig({})).toEqual(base);
  });

  it('включает api только при заданных флаге и URL', () => {
    expect(readBackendConfig({ VITE_DATA_BACKEND: 'api', VITE_API_URL: 'https://api.example' })).toEqual({
      backend: 'api',
      apiUrl: 'https://api.example',
      shadow: false,
      dualWrite: false,
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
    ).toMatchObject({ backend: 'api', apiUrl: 'https://api.example' });
  });

  it('включает теневые чтения и dual-write только на firebase и с URL', () => {
    expect(
      readBackendConfig({
        VITE_API_URL: 'https://api.example',
        VITE_SHADOW_API: '1',
        VITE_DUAL_WRITE: 'true',
      }),
    ).toMatchObject({ backend: 'firebase', shadow: true, dualWrite: true });
  });

  it('не включает теневые режимы без URL API', () => {
    expect(readBackendConfig({ VITE_SHADOW_API: '1', VITE_DUAL_WRITE: '1' })).toMatchObject({
      shadow: false,
      dualWrite: false,
    });
  });
});
