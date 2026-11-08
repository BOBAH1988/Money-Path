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
import { COLLECTIONS, migrateCollectionToUser, trackUser } from '../lib/firestore';

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
  const [uid, setUid] = useState<string | undefined>(() =>
    localStorage.getItem('denegnyj_put_auth_uid') || undefined
  );

  const isAdmin = isAuthenticated && user ? user.email === ADMIN_EMAIL : false;

  const migrateAllToUser = async (userId: string) => {
    for (const collection of Object.values(COLLECTIONS)) {
      try {
        await migrateCollectionToUser(collection, userId);
      } catch {
        // ignore per-collection errors
      }
    }
  };

  useEffect(() => {
    // Быстрая проверка localStorage — не ждём Firebase для отображения данных
    const savedUid = localStorage.getItem('denegnyj_put_auth_uid');
    if (savedUid) {
      setUid(savedUid);
      setIsAuthenticated(true);
    }
    setIsAuthReady(true);

    if (!auth) {
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setUid(u.uid);
        setIsAuthenticated(true);
        localStorage.setItem('denegnyj_put_auth_uid', u.uid);
        // Не ждём Firestore — синхронизируем в фоне
        migrateAllToUser(u.uid).catch(() => {});
        trackUser(u.uid, u.email ?? '').catch(() => {});
      } else {
        setUid(undefined);
        setIsAuthenticated(false);
        localStorage.removeItem('denegnyj_put_auth_uid');
      }
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    await signInWithEmailAndPassword(auth, email, password);
    setIsAuthenticated(true);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // ignore
    }
    try {
      await trackUser(credential.user.uid, email);
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
  };

  const logout = async () => {
    if (!auth) throw new Error('Firebase Auth не инициализирован');
    await signOut(auth);
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
