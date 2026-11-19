import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface AuthUser {
  uid: string;
  email: string | null;
  /** false для аккаунтов, не подтвердивших почту — такие запросы отклоняются. */
  emailVerified: boolean;
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthUser>;
}

export interface FirebaseVerifierOptions {
  projectId?: string;
}

/**
 * Проверяет Firebase ID-token через firebase-admin.
 * checkRevoked=true: после смены пароля/отзыва сессий старый токен отклоняется —
 * это и есть серверная ревокация, которая раньше обеспечивалась Firebase из коробки.
 */
export const createFirebaseVerifier = (options: FirebaseVerifierOptions = {}): TokenVerifier => {
  const app = getApps()[0] ?? initializeApp({
    credential: applicationDefault(),
    projectId: options.projectId,
  });
  const auth = getAuth(app);

  return {
    async verify(token: string): Promise<AuthUser> {
      const decoded = await auth.verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : null,
        emailVerified: decoded.email_verified === true,
      };
    },
  };
};
