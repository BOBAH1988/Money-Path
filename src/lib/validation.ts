import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

// Список самых частых паролей и шаблонных основ: такие значения запрещаем
// отдельно, иначе они проходят формальные буквенно-цифровые требования.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'qwerty', 'qwerty123', 'qwertyuiop', '12345678', '123456789', '1234567890',
  '12345678910', 'iloveyou', 'welcome', 'welcome1', 'welcome123', 'admin123',
  'administrator', 'letmein', 'monkey123', 'dragon123', 'football', 'baseball',
  'sunshine', 'princess', 'abc12345', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx',
  'q1w2e3r4', 'asdfghjk', 'asdf1234', 'trustno1', 'changeme', 'superman',
  'master123', 'shadow123', 'michael123', 'jennifer', 'matthew123',
]);

const isCommonPassword = (value: string) => {
  // Сравниваем только буквы и цифры: спецсимволы вида «Password1!» не делают
  // частый пароль безопасным.
  const core = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMMON_PASSWORDS.has(core)) return true;
  // Отсекаем хвосты вида «password2026» и «qwerty1234».
  return COMMON_PASSWORDS.has(core.replace(/\d+$/, ''));
};

export const passwordRequirements = [
  `не менее ${PASSWORD_MIN_LENGTH} символов`,
  `не более ${PASSWORD_MAX_LENGTH} символов`,
  'заглавная и строчная буквы',
  'хотя бы одна цифра',
  'хотя бы один спецсимвол (!@#$%^&* и подобные)',
  'не входит в список частых паролей',
];

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов`)
  .max(PASSWORD_MAX_LENGTH, `Пароль должен содержать не более ${PASSWORD_MAX_LENGTH} символов`)
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
  .regex(/[a-z]/, 'Пароль должен содержать строчную букву')
  .regex(/\d/, 'Пароль должен содержать цифру')
  .regex(/[^A-Za-z0-9]/, 'Пароль должен содержать хотя бы один спецсимвол')
  .refine((v) => !isCommonPassword(v), 'Такой пароль слишком простой и часто встречается')
  .refine((v) => !/^(.{1,4})\1+$/.test(v), 'Пароль не должен состоять из повторяющегося фрагмента');

export const emailSchema = z.string().email('Некорректный email адрес');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  agreeTerms: z.boolean().refine((v) => v === true, 'Нужно согласиться с правилами использования'),
  agreePrivacy: z.boolean().refine((v) => v === true, 'Нужно согласиться на обработку персональных данных'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

export const forgotSchema = z.object({
  email: emailSchema,
});

export const budgetItemSchema = z.object({
  name: z.string().min(1, 'Введите название').max(100, 'Название слишком длинное'),
  amount: z.number().nonnegative('Сумма не может быть отрицательной'),
  plan: z.number().nonnegative('План не может быть отрицательным'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotFormData = z.infer<typeof forgotSchema>;
export type BudgetItemFormData = z.infer<typeof budgetItemSchema>;

export const incomeArchiveSchema = z.object({
  name: z.string().min(1, 'Введите название источника').max(100, 'Название слишком длинное'),
  year: z.number().min(2000, 'Год не может быть раньше 2000').max(2100, 'Год не может быть позже 2100'),
  months: z.array(z.number().nonnegative('Сумма не может быть отрицательной')).length(12, 'Нужно 12 месяцев'),
});

export type IncomeArchiveFormData = z.infer<typeof incomeArchiveSchema>;
