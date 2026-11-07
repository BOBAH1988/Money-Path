import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать не менее 8 символов')
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
  .regex(/[a-z]/, 'Пароль должен содержать строчную букву')
  .regex(/\d/, 'Пароль должен содержать цифру');

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
  agreeCookies: z.boolean().refine((v) => v === true, 'Нужно согласиться на использование cookie'),
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
