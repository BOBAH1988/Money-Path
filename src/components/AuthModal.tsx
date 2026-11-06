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

export const AccountMenu = ({ onClose, onAnalytics }: { onClose: () => void; onAnalytics?: () => void }) => {
  const { user, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleAnalytics = () => {
    onClose();
    onAnalytics?.();
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card account-menu-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="auth-title">Аккаунт</h2>
        <div className="account-info">
          <span className="account-icon">👤</span>
          <span className="account-email">{user?.email}</span>
          {isAdmin && (
            <span className="account-badge">Администратор</span>
          )}
        </div>
        <div className="account-actions">
          <button className="account-action-btn" onClick={handleLogout}>
            <span>👋</span> Выйти
          </button>
          {isAdmin && (
            <button className="account-action-btn" onClick={handleAnalytics}>
              <span>📊</span> Аналитика
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const AnalyticsModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="auth-title">Аналитика</h2>
        <div className="analytics-stats">
          <div className="analytics-stat">
            <span className="analytics-label">Всего зарегистрированных пользователей:</span>
            <span className="analytics-value">1</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Активных:</span>
            <span className="analytics-value">1</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Новый за 30 дней:</span>
            <span className="analytics-value">1</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Новых за 7 дней:</span>
            <span className="analytics-value">1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountButton = ({ onOpen }: { onOpen: () => void }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <button className="account-btn" disabled title="Загрузка…" aria-label="Аккаунт">
        ⏳
      </button>
    );
  }

  if (!user) {
    return (
      <button className="account-btn" onClick={onOpen} aria-label="Аккаунт">
        👤
      </button>
    );
  }

  return (
    <button className="account-btn" onClick={onOpen} aria-label="Аккаунт">
      👤
    </button>
  );
};
