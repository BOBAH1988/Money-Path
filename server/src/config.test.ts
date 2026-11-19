import { describe, expect, it } from 'vitest';
import { loadEnv } from './config.js';

describe('loadEnv', () => {
  it('подставляет значения по умолчанию', () => {
    const env = loadEnv({});

    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('приводит PORT к числу', () => {
    expect(loadEnv({ PORT: '3000' }).PORT).toBe(3000);
  });

  it('падает на невалидном PORT', () => {
    expect(() => loadEnv({ PORT: 'не число' })).toThrow();
  });
});
