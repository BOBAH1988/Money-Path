import { useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AuthContext } from './AuthContextObject';

import { ADMIN_EMAIL } from './auth-constants';

export { useAuth } from '../hooks/useAuth';

export const EMAIL_NOT_VERIFIED_CODE = 'auth/email-not-verified';
export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Перед входом подтвердите адрес электронной почты. Письмо с ссылкой отправлено на вашу почту.';

/** Ошибка входа с кодом Firebase-подобного формата, чтобы AuthModal показал понятное сообщение. */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [uid, setUid] = useState<string | undefined>(undefined);

  const isAdmin = isAuthenticated && user
    ? user.email === ADMIN_EMAIL && user.emailVerified
    : false;

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setUid(u.uid);
        setIsAuthenticated(true);
        // Синхронизация не должна блокировать первый рендер приложения.
        void import('../lib/firestore').then(({ syncPendingToFirestore, trackUser }) =>
          Promise.all([
            syncPendingToFirestore(u.uid).catch((err) => {
              console.error('[firestore] syncPendingToFirestore ошибка:', err);
            }),
            trackUser(u.uid, u.email ?? ''),
          ]),
        ).catch((err) => console.error('[firestore] инициализация синхронизации ошибка:', err));
      } else {
        setUid(undefined);
        setIsAuthenticated(false);
        localStorage.removeItem('denegnyj_put_auth_uid');
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] login ошибка:', err instanceof Error ? err.message : err);
      throw err;
    }
    // Токен после входа может содержать устаревший emailVerified: обновляем профиль,
    // иначе подтверждённая почта выглядит неподтверждённой и вход обрывается ошибкой.
    try {
      await credential.user.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] login: reload профиля не удался:', err instanceof Error ? err.message : err);
    }
    if (!credential.user.emailVerified) {
      // signInWithEmailAndPassword уже создал сессию: без выхода пользователь
      // окажется в приложении, хотя вход признан неуспешным.
      await signOut(auth).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[auth] login: signOut после неподтверждённой почты:', err instanceof Error ? err.message : err);
      });
      throw new AuthError(EMAIL_NOT_VERIFIED_CODE, EMAIL_NOT_VERIFIED_MESSAGE);
    }
    setIsAuthenticated(true);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    let credential: { user: User };
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] register ошибка:', err instanceof Error ? err.message : err);
      throw err;
    }
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // ignore — пользователь уже создан
    }
    try {
      const { trackUser } = await import('../lib/firestore');
      await trackUser(credential.user.uid, email);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[firestore] register trackUser uid=${credential.user.uid} ошибка:`,
        err instanceof Error ? err.message : err,
      );
      // Не бросаем — аккаунт создан, пользователь может войти
    }
    setIsAuthenticated(true);
  };

  const logout = async () => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    try {
      await signOut(auth);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] logout ошибка:', err instanceof Error ? err.message : err);
      throw err;
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  const deleteAccount = async (password: string) => {
    if (!auth || !user?.email) throw new Error('Не удалось определить аккаунт для удаления');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    const { deleteAccountData } = await import('../lib/firestore');
    await deleteAccountData(user.uid);
    try {
      await deleteUser(user);
    } catch (err) {
      const reason = err instanceof Error ? ` (${err.message})` : '';
      throw new Error(
        `Данные удалены, но аккаунт Firebase не удалось удалить${reason}. Перезагрузите страницу и повторите удаление аккаунта.`,
        { cause: err },
      );
    }
    setUser(null);
    setUid(undefined);
    setIsAuthenticated(false);
  };

  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async (user: User) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    await sendEmailVerification(user);
  };

  const value = {
    user,
    uid,
    isAuthenticated,
    isAuthReady,
    isAdmin,
    login,
    register,
    logout,
    deleteAccount,
    sendPasswordReset,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
