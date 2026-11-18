import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth, EMAIL_NOT_VERIFIED_CODE } from './AuthContext';

const { signInWithEmailAndPassword, signOut, reload } = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(async () => {}),
  reload: vi.fn(async () => {}),
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword: vi.fn(),
  signOut,
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    cb(null);
    return () => {};
  },
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({ auth: {} }));

const Probe = () => {
  const { login, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button onClick={() => { void login('user@example.com', 'secret123').catch(() => {}); }}>
        Войти
      </button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthContext.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue(undefined);
    reload.mockResolvedValue(undefined);
    cleanup();
  });

  it('входит, если после reload почта подтверждена', async () => {
    const user = { email: 'user@example.com', emailVerified: true, reload, uid: 'u1' };
    signInWithEmailAndPassword.mockResolvedValue({ user });
    renderProbe();

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));
    expect(reload).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('подхватывает подтверждение почты, обновив профиль через reload', async () => {
    const user = { email: 'user@example.com', emailVerified: false, reload, uid: 'u1' };
    signInWithEmailAndPassword.mockResolvedValue({ user });
    reload.mockImplementation(async () => { user.emailVerified = true; });
    renderProbe();

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));
    expect(screen.getByTestId('auth')).toHaveTextContent('yes');
  });

  it('не оставляет сессию при неподтверждённой почте и отдаёт код ошибки', async () => {
    const user = { email: 'user@example.com', emailVerified: false, reload, uid: 'u1' };
    signInWithEmailAndPassword.mockResolvedValue({ user });
    let caught: any;
    render(
      <AuthProvider>
        <LogoutProbe onError={(err) => { caught = err; }} />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    });

    await waitFor(() => expect(caught).toBeDefined());
    expect(caught.code).toBe(EMAIL_NOT_VERIFIED_CODE);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
  });
});

const LogoutProbe = ({ onError }: { onError: (err: unknown) => void }) => {
  const { login, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button onClick={() => { void login('user@example.com', 'secret123').catch(onError); }}>
        Войти
      </button>
    </div>
  );
};
