import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginSchema, registerSchema, forgotSchema, type LoginFormData, type RegisterFormData, type ForgotFormData } from '../lib/validation';
import { useToast } from '../ui/Toast';
import { getAllUsers } from '../lib/firestore';

type Mode = 'login' | 'register' | 'forgot' | 'verify';

export const AuthModal = ({ onClose }: { onClose: () => void }) => {
  const { login, register, sendPasswordReset } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const previousAuthActive = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousAuthActive.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
      if (previousAuthActive.current) previousAuthActive.current.focus();
    };
  }, [onClose]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateForm = (data: LoginFormData | RegisterFormData | ForgotFormData): boolean => {
    if (mode === 'login') {
      const result = loginSchema.safeParse(data as LoginFormData);
      if (!result.success) {
        setValidationErrors(result.error.issues.map((e) => e.message));
        return false;
      }
      setValidationErrors([]);
      return true;
    }
    if (mode === 'forgot') {
      const result = forgotSchema.safeParse(data as ForgotFormData);
      if (!result.success) {
        setValidationErrors(result.error.issues.map((e) => e.message));
        return false;
      }
      setValidationErrors([]);
      return true;
    }
    if (mode === 'register') {
      const result = registerSchema.safeParse(data as RegisterFormData);
      if (!result.success) {
        setValidationErrors(result.error.issues.map((e) => e.message));
        return false;
      }
      setValidationErrors([]);
      return true;
    }
    setValidationErrors([]);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      const formData = { email, password, confirmPassword, agreeTerms, agreePrivacy };
      if (!validateForm(formData)) {
        setError(validationErrors.join(', '));
        setSubmitting(false);
        return;
      }

      if (mode === 'login') {
        await login(email, password);
        toastSuccess('Вход выполнен');
        onClose();
      } else if (mode === 'forgot') {
        await sendPasswordReset(email);
        toastSuccess('Письмо отправлено', 'Ссылка для восстановления пароля отправлена на ' + email);
        setSubmitting(false);
      } else {
        await register(email, password);
        toastSuccess('Регистрация успешна', 'Письмо с подтверждением почты отправлено на ' + email);
        setSubmitting(false);
      }
    } catch (err: any) {
      const msg =
        err.code === 'auth/email-already-in-use'
          ? 'Пользователь с таким email уже зарегистрирован'
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Неверный email или пароль'
          : err.code === 'auth/invalid-email'
          ? 'Некорректный email'
          : err.message || 'Ошибка';
      toastError('Ошибка авторизации', msg);
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    clearMessages();
    setSubmitting(true);
    try {
      setSuccess('Письмо с подтверждением отправлено повторно');
      setSubmitting(false);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
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
          {mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : mode === 'forgot' ? 'Восстановление пароля' : 'Подтверждение почты'}
        </h2>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {mode === 'verify' && (
          <div className="auth-verify">
            <p>Проверьте почту и перейдите по ссылке из письма для подтверждения адреса.</p>
            <button className="auth-btn" onClick={handleResend} disabled={submitting}>
              {submitting ? 'Отправка...' : 'Отправить повторно'}
            </button>
            <p className="auth-hint">
              После подтверждения вы сможете войти в аккаунт.
            </p>
          </div>
        )}

        {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
          <form onSubmit={handleSubmit} className="auth-form">
            {mode !== 'forgot' && (
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
            )}
            {mode === 'forgot' && (
              <div className="auth-field">
                <label>Email для восстановления</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <p className="auth-hint">На этот адрес придет ссылка для сброса пароля</p>
              </div>
            )}
            {(mode === 'login' || mode === 'register') && (
              <div className="auth-field">
                <label>Пароль</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {mode === 'register' && validationErrors.length > 0 && (
                  <div className="auth-password-hints">
                    {validationErrors.map((err, i) => (
                      <span key={i} className="auth-hint-error">✕ {err}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            {mode === 'register' && (
              <>
                <div className="auth-field auth-checkbox-field">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      required
                    />
                    Я принимаю <Link to="/terms" onClick={onClose}>условия использования</Link>
                  </label>
                </div>
                <div className="auth-field auth-checkbox-field">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      required
                    />
                    Я согласен на обработку персональных данных согласно{' '}
                    <Link to="/privacy" onClick={onClose}>уведомлению о конфиденциальности</Link>
                  </label>
                </div>
              </>
            )}
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
              disabled={submitting || (mode === 'register' && (!agreeTerms || !agreePrivacy))}
            >
              {submitting ? 'Подождите...' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        <p className="auth-toggle">
          {mode === 'login'
            ? 'Нет аккаунта? '
            : mode === 'register'
            ? 'Уже есть аккаунт? '
            : 'Вернуться к входу? '}
          <button
            type="button"
            onClick={() => {
              clearMessages();
              setMode(mode === 'login' ? 'register' : mode === 'register' ? 'login' : 'login');
            }}
            className="auth-toggle-btn"
          >
            {mode === 'login' ? 'Создать' : mode === 'register' ? 'Войти' : 'Войти'}
          </button>
          {mode === 'login' && (
            <>
              {'  '}
              <button type="button" onClick={() => { clearMessages(); setMode('forgot'); }} className="auth-toggle-btn">
                Забыли пароль?
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export const AccountMenu = ({ onClose, onAnalytics }: { onClose: () => void; onAnalytics?: () => void }) => {
  const { user, isAdmin, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleAnalytics = () => {
    onClose();
    onAnalytics?.();
  };

  return (
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
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
            Выйти
          </button>
          {isAdmin && (
            <button className="account-action-btn" onClick={handleAnalytics}>
              Аналитика
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const AnalyticsModal = ({ onClose }: { onClose: () => void }) => {
  const { isAdmin, uid } = useAuth();
  const [users, setUsers] = useState<{ uid: string; email: string; createdAt: string; lastActive: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await getAllUsers(uid);
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const total = users.length;
  const active = users.filter((u) => {
    const d = u.lastActive ? new Date(u.lastActive) : null;
    return Boolean(d && d >= thirtyDaysAgo);
  }).length;
  const new30 = users.filter((u) => {
    const d = u.createdAt ? new Date(u.createdAt) : null;
    return Boolean(d && d >= thirtyDaysAgo);
  }).length;
  const new7 = users.filter((u) => {
    const d = u.createdAt ? new Date(u.createdAt) : null;
    return Boolean(d && d >= sevenDaysAgo);
  }).length;

  if (loading) {
    return (
      <div className="auth-overlay" onClick={onClose}>
        <div className="auth-card" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <h2 className="auth-title">Аналитика</h2>
          <p>Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-overlay" onClick={onClose}>
        <div className="auth-card" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
          <h2 className="auth-title">Аналитика</h2>
          <div className="auth-error">{error}</div>
        </div>
      </div>
    );
  }

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
            <span className="analytics-value">{total}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Активных:</span>
            <span className="analytics-value">{active}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Новый за 30 дней:</span>
            <span className="analytics-value">{new30}</span>
          </div>
          <div className="analytics-stat">
            <span className="analytics-label">Новых за 7 дней:</span>
            <span className="analytics-value">{new7}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountButton = ({ onOpen }: { onOpen: () => void }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
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
