import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

import { ADMIN_EMAIL } from './auth-constants';

interface AuthContextValue {
  user: User | null;
  uid: string | undefined;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // uid берём только из Firebase Auth. Не hydrate-им из localStorage до onAuthStateChanged,
  // иначе эффекты загрузки данных стартуют с чужим/устаревшим uid до появления ID-токена
  const [uid, setUid] = useState<string | undefined>(undefined);

  const isAdmin = isAuthenticated && user ? user.email === ADMIN_EMAIL : false;

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
        void (async () => {
          try {
            const { syncPendingToFirestore, trackUser } = await import('../lib/firestore');
            await syncPendingToFirestore(u.uid);
            await trackUser(u.uid, u.email ?? '');
          } catch {
            // ignore
          }
        })();
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
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] login ошибка:', err instanceof Error ? err.message : err);
      throw err;
    }
    setIsAuthenticated(true);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await sendEmailVerification(credential.user);
      } catch {
        // ignore
      }
      try {
        const { trackUser } = await import('../lib/firestore');
        await trackUser(credential.user.uid, email);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `[firestore] register trackUser uid=${credential.user.uid} ошибка:`,
          err instanceof Error ? err.message : err
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] register ошибка:', err instanceof Error ? err.message : err);
      throw err;
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
    sendPasswordReset,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
