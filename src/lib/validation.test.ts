import { describe, expect, it } from 'vitest';
import { registerSchema } from './validation';

const registration = {
  email: 'person@example.com',
  password: 'Password1',
  confirmPassword: 'Password1',
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
