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
import {
  ACCOUNT_DELETION_DONE_CODE,
  AuthError,
  EMAIL_NOT_VERIFIED_CODE,
  EMAIL_NOT_VERIFIED_MESSAGE,
  EMAIL_NOT_SENT_CODE,
  SESSION_NOT_READY_CODE,
  afterVerificationSent,
  mapVerificationError,
} from '../lib/auth-errors';

import { ADMIN_EMAIL } from './auth-constants';

export { useAuth } from '../hooks/useAuth';
export { AuthError, EMAIL_NOT_VERIFIED_CODE, EMAIL_NOT_VERIFIED_MESSAGE };

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

  /**
   * Вход без подъёма красной плашки для ожидаемого случая — неподтверждённой почты.
   * Firebase создаёт сессию до проверки emailVerified, поэтому сессию закрываем,
   * а наружу отдаём ошибку с кодом EMAIL_NOT_VERIFIED_CODE.
   */
  const signInVerified = async (email: string, password: string): Promise<User> => {
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
      await signOut(auth).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[auth] login: signOut после неподтверждённой почты:', err instanceof Error ? err.message : err);
      });
      throw new AuthError(EMAIL_NOT_VERIFIED_CODE, EMAIL_NOT_VERIFIED_MESSAGE);
    }
    setIsAuthenticated(true);
    return credential.user;
  };

  const login = async (email: string, password: string) => {
    const signedIn = await signInVerified(email, password);
    const { getScheduledDeletion, isDeletionDue } = await import('../lib/account-deletion');
    const scheduled = getScheduledDeletion(signedIn.uid);
    // Период восстановления истёк: удаление выполняется при следующем входе,
    // потому что без Cloud Functions ничто не разбудит клиент раньше.
    if (scheduled && isDeletionDue(scheduled)) {
      await eraseAccount(signedIn);
      throw new AuthError(
        ACCOUNT_DELETION_DONE_CODE,
        `Аккаунт удалён: срок восстановления истёк ${new Date(scheduled.deleteAt).toLocaleDateString('ru-RU')}.`,
      );
    }
  };

  /**
   * Повторная отправка письма. Без активной сессии Firebase не вышлет письмо,
   * поэтому входим паролем; неверный пароль — отдельная ошибка, а не «письмо отправлено».
   */
  const resendVerification = async (
    email: string,
    password?: string,
  ): Promise<{ sent: boolean; message: string }> => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    let target: User | null = auth.currentUser ?? user;
    if (!target || target.email !== email) {
      if (!password) {
        throw new AuthError(
          SESSION_NOT_READY_CODE,
          'Введите пароль, чтобы отправить письмо ещё раз.',
        );
      }
      try {
        target = await signInVerified(email, password);
      } catch (err) {
        if ((err as { code?: string }).code === EMAIL_NOT_VERIFIED_CODE) {
          // Пароль верный, но сессия закрыта при выходе — signIn создал её заново
          // до выхода; отправляем письмо уже от имени закрытой сессии нельзя,
          // поэтому повторно входим без проверки и сразу выходим.
          const credential = await signInWithEmailAndPassword(auth, email, password);
          try {
            await sendEmailVerification(credential.user);
            return { sent: true, message: afterVerificationSent(email) };
          } finally {
            await signOut(auth).catch(() => {});
          }
        }
        throw err;
      }
    }
    try {
      await sendEmailVerification(target);
      return { sent: true, message: afterVerificationSent(email) };
    } catch (err) {
      const reason = mapVerificationError(err);
      // eslint-disable-next-line no-console
      console.error('[auth] sendEmailVerification ошибка:', err);
      throw new AuthError(
        EMAIL_NOT_SENT_CODE,
        reason ?? `Не удалось отправить письмо: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`,
      );
    }
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
      afterVerificationSent(email);
    } catch (err) {
      // Аккаунт уже создан, поэтому не прерываем регистрацию, но и не врём про
      // отправленное письмо: показываем реальную причину сбоя.
      // eslint-disable-next-line no-console
      console.error('[auth] register: sendEmailVerification ошибка:', err);
      const reason = mapVerificationError(err);
      throw new AuthError(
        EMAIL_NOT_SENT_CODE,
        reason ?? `Аккаунт создан, но письмо не отправлено: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`,
      );
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

  /**
   * Полное удаление: данные, профиль и аккаунт Firebase. Вызывается только
   * после истечения срока восстановления — до него действует scheduleAccountDeletion.
   */
  const eraseAccount = async (currentUser: User) => {
    const { deleteAccountData } = await import('../lib/firestore');
    await deleteAccountData(currentUser.uid);
    try {
      await deleteUser(currentUser);
    } catch (err) {
      const reason = err instanceof Error ? ` (${err.message})` : '';
      throw new Error(
        `Данные удалены, но аккаунт Firebase не удалось удалить${reason}. Перезагрузитесь и повторите.`,
        { cause: err },
      );
    }
    const { cancelScheduledDeletion } = await import('../lib/account-deletion');
    cancelScheduledDeletion(currentUser.uid);
    setUser(null);
    setUid(undefined);
    setIsAuthenticated(false);
  };

  const deleteAccount = async (password: string) => {
    if (!auth || !user?.email) throw new Error('Не удалось определить аккаунт для удаления');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    await eraseAccount(user);
  };

  /**
   * Ставит удаление в очередь на срок восстановления: пароль проверяется сразу,
   * но данные остаются на месте, и вход продолжает работать.
   */
  const scheduleAccountDeletion = async (password: string) => {
    if (!auth || !user?.email) throw new Error('Не удалось определить аккаунт для удаления');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    const { scheduleAccountDeletion: schedule } = await import('../lib/account-deletion');
    const record = schedule(user.uid, user.email);
    return { deleteAt: record.deleteAt, email: user.email };
  };

  const cancelAccountDeletion = () => {
    if (!user?.uid) return;
    void import('../lib/account-deletion').then(({ cancelScheduledDeletion }) => {
      cancelScheduledDeletion(user.uid);
    });
  };

  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    await sendPasswordResetEmail(auth, email);
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
    scheduleAccountDeletion,
    cancelAccountDeletion,
    sendPasswordReset,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
