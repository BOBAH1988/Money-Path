import { describe, expect, it } from 'vitest';
import { passwordRequirements, passwordSchema, PASSWORD_MAX_LENGTH, registerSchema } from './validation';

const registration = {
  email: 'person@example.com',
  password: 'Gorod-2026!x',
  confirmPassword: 'Gorod-2026!x',
  agreeTerms: true,
  agreePrivacy: true,
};

describe('registerSchema', () => {
  it('accepts registration after terms and privacy consent', () => {
    expect(registerSchema.safeParse(registration).success).toBe(true);
  });

  it('requires privacy consent', () => {
    expect(registerSchema.safeParse({ ...registration, agreePrivacy: false }).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  const valid = 'Gorod-2026!x';

  it('accepts a long password with letters, digits and a symbol', () => {
    expect(passwordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects passwords shorter than the minimum length', () => {
    expect(passwordSchema.safeParse('Ab1!').success).toBe(false);
  });

  it('rejects passwords longer than the maximum length', () => {
    expect(passwordSchema.safeParse('Aa1!' + 'x'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(false);
  });

  it('rejects passwords without a special character', () => {
    expect(passwordSchema.safeParse('Gorod20261x').success).toBe(false);
  });

  it('rejects passwords without digits', () => {
    expect(passwordSchema.safeParse('Gorod-abcdef!').success).toBe(false);
  });

  it('rejects passwords without mixed case', () => {
    expect(passwordSchema.safeParse('gorod-2026!x').success).toBe(false);
  });

  it('rejects common passwords even if they meet the formal rules', () => {
    expect(passwordSchema.safeParse('Password1!').success).toBe(false);
    expect(passwordSchema.safeParse('Qwerty1234!').success).toBe(false);
  });

  it('rejects a password made of one repeated fragment', () => {
    expect(passwordSchema.safeParse('abababababab').success).toBe(false);
  });

  it('lists the requirements for the registration form', () => {
    expect(passwordRequirements.join(' ')).toContain('не менее 10 символов');
  });
});
