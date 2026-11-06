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
import { COLLECTIONS, migrateCollectionToUser } from '../lib/firestore';

const ADMIN_EMAIL = '79042044926@ya.ru';

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

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
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
    if (!auth) {
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // Не помечаем как аутентифицированного автоматически — только после явного входа
      if (u) {
        await migrateAllToUser(u.uid);
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
    isAuthenticated,
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
