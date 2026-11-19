import { describe, expect, it } from 'vitest';
import { ApiError } from './apiClient';
import { describeApiError, errorText } from './api-errors';

describe('describeApiError', () => {
  it('даёт понятный текст для известных кодов', () => {
    expect(describeApiError(new ApiError(401, 'UNAUTHENTICATED', 'Требуется авторизация'))).toContain(
      'Войдите снова',
    );
    expect(describeApiError(new ApiError(403, 'FORBIDDEN', 'Недостаточно прав'))).toBe(
      'Недостаточно прав для этого действия.',
    );
    expect(describeApiError(new ApiError(503, 'INTERNAL', 'База данных не настроена'))).toContain(
      'временно недоступен',
    );
  });

  it('не подменяет незнакомый код', () => {
    expect(describeApiError(new ApiError(418, 'TEAPOT', 'Я чайник'))).toBeNull();
  });

  it('игнорирует не-API ошибки', () => {
    expect(describeApiError(new Error('network error'))).toBeNull();
    expect(describeApiError(null)).toBeNull();
  });
});

describe('errorText', () => {
  it('берёт словарь для кодов API', () => {
    expect(errorText(new ApiError(404, 'NOT_FOUND', 'Ресурс не найден'), 'Ошибка')).toBe(
      'Запись уже удалена — возможно, на другом устройстве.',
    );
  });

  it('показывает сообщение обычной ошибки', () => {
    expect(errorText(new Error('network error'), 'Ошибка')).toBe('network error');
  });

  it('возвращает запасной текст для неизвестного значения', () => {
    expect(errorText({ weird: true }, 'Ошибка загрузки')).toBe('Ошибка загрузки');
  });
});
