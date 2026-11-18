import type { User } from 'firebase/auth';

export const EMAIL_NOT_VERIFIED_CODE = 'auth/email-not-verified';
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Перед входом подтвердите адрес электронной почты. Письмо с ссылкой отправлено на вашу почту.';

export const SESSION_NOT_READY_CODE = 'auth/session-not-ready';
export const SESSION_NOT_READY_MESSAGE =
  'Сессия восстанавливается. Подождите пару секунд и попробуйте снова.';

export const EMAIL_NOT_SENT_CODE = 'auth/email-not-sent';

/** Ошибка входа с Firebase-подобным кодом, чтобы интерфейс показал понятное сообщение. */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Время между повторными отправками письма: Firebase ограничивает частоту запросов. */
export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

const EMAIL_VERIFICATION_STORAGE_KEY = 'denegnyj_put_verification_sent';

type SentRecord = Record<string, number>;

const readSent = (): SentRecord => {
  try {
    const raw = localStorage.getItem(EMAIL_VERIFICATION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as SentRecord) : {};
  } catch {
    return {};
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Метка последней отправки письма подтверждения для адреса (0 — не отправляли). */
export const getVerificationSentAt = (email: string): number =>
  readSent()[normalizeEmail(email)] ?? 0;

/** Запоминает время отправки письма, чтобы лимит сохранялся после перезагрузки страницы. */
export const markVerificationSent = (email: string, at = Date.now()): void => {
  const sent = readSent();
  sent[normalizeEmail(email)] = at;
  try {
    localStorage.setItem(EMAIL_VERIFICATION_STORAGE_KEY, JSON.stringify(sent));
  } catch {
    // хранилище недоступно — лимит будет действовать только до перезагрузки
  }
};

/** Остаток времени до следующей разрешённой отправки в миллисекундах. */
export const getVerificationCooldownLeft = (email: string, now = Date.now()): number => {
  const sentAt = getVerificationSentAt(email);
  if (!sentAt) return 0;
  return Math.max(0, sentAt + VERIFICATION_RESEND_COOLDOWN_MS - now);
};

/**
 * Сообщает, почему письмо подтверждения не ушло, и предлагает повторную отправку.
 * Возвращает текст ошибки, если письмо не отправлено, иначе null.
 */
export const mapVerificationError = (err: unknown): string | null => {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/too-many-requests':
      return 'Слишком много запросов. Письмо можно отправить снова через минуту.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
      return 'Домен приложения не разрешён в Firebase — письмо не отправлено. Добавьте домен в Authorized domains проекта.';
    case 'auth/network-request-failed':
      return 'Нет подключения к интернету — письмо не отправлено.';
    case 'auth/user-disabled':
      return 'Аккаунт отключён — письмо не отправлено.';
    default:
      return null;
  }
};

/** Готовит пользователю сообщение об отправке письма и запоминает время отправки. */
export const afterVerificationSent = (email: string): string => {
  markVerificationSent(email);
  return `Письмо отправлено на ${email}. Проверьте «Входящие» и «Спам».`;
};

export type { User };
