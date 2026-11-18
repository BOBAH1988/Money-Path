import { createContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthContextValue {
  user: User | null;
  uid: string | undefined;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  scheduleAccountDeletion: (password: string) => Promise<{ deleteAt: string; email: string }>;
  cancelAccountDeletion: () => void;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: (email: string, password?: string) => Promise<{ sent: boolean; message: string }>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
