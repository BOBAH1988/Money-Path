export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '79042044926@ya.ru';

export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
};

export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`не менее ${PASSWORD_RULES.minLength} символов`);
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('заглавная буква');
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('строчная буква');
  }
  if (PASSWORD_RULES.requireDigit && !/\d/.test(password)) {
    errors.push('цифра');
  }
  return errors;
};
