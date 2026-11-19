import { ApiError } from './apiClient';

/**
 * Тексты для кодов собственного API. Сервер присылает `code` + короткое `message`;
 * клиент добавляет только то, чего сервер знать не может — что стало с локальными
 * данными и что делать пользователю. Формулировки сервера не переписываются.
 */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Сессия истекла. Войдите снова — изменения остались на устройстве.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  NOT_FOUND: 'Запись уже удалена — возможно, на другом устройстве.',
  VALIDATION_ERROR: 'Сервер отклонил данные: они не прошли проверку.',
  INTERNAL: 'Сервис временно недоступен. Изменения сохранены на устройстве.',
};

/** Понятный текст для ошибки API или `null`, если ошибка не от нашего сервера. */
export const describeApiError = (err: unknown): string | null => {
  if (!(err instanceof ApiError)) return null;
  return MESSAGES[err.code] ?? null;
};

/** Текст для показа: сначала наш словарь, затем сообщение ошибки, затем запасной вариант. */
export const errorText = (err: unknown, fallback: string): string =>
  describeApiError(err) ?? (err instanceof Error && err.message ? err.message : fallback);
