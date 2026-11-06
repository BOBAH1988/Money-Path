import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register';

export const AuthModal = ({ onClose }: { onClose: () => void }) => {
  const { login, register, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (password !== confirmPassword) {
          setError('Пароли не совпадают');
          setSubmitting(false);
          return;
        }
        await register(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Пользователь с таким email уже зарегистрирован'
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Неверный email или пароль'
          : err.message || 'Ошибка входа'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="auth-title">
          {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
        </h2>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label>Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'register' && (
            <div className="auth-field">
              <label>Подтвердите пароль</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}
          <button
            type="submit"
            className="auth-btn"
            disabled={submitting || authLoading}
          >
            {submitting ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="auth-toggle">
          {mode === 'login'
            ? 'Нет аккаунта? '
            : 'Уже есть аккаунт? '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="auth-toggle-btn">
            {mode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};

export const AccountButton = ({ onOpen }: { onOpen: () => void }) => {
  const { user, logout, loading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <button className="account-btn" disabled title="Загрузка…" aria-label="Аккаунт">
        ⏳
      </button>
    );
  }

  if (user) {
    return (
      <div className="account-user" onClick={handleLogout} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleLogout()}>
        <span className="account-icon">👤</span>
        <span className="account-email">{user.email}</span>
        <span className="account-logout">Выйти</span>
      </div>
    );
  }

  return (
    <button className="account-btn" onClick={onOpen} aria-label="Аккаунт">
      👤
    </button>
  );
};
