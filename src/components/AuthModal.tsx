import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, EMAIL_NOT_VERIFIED_CODE } from '../context/AuthContext';
import { EMAIL_NOT_SENT_CODE, getVerificationCooldownLeft } from '../lib/auth-errors';
import {
  cancelScheduledDeletion,
  deletionDaysLeft,
  formatDeletionDate,
  getScheduledDeletion,
} from '../lib/account-deletion';
import { loginSchema, registerSchema, forgotSchema, type LoginFormData, type RegisterFormData, type ForgotFormData } from '../lib/validation';
import { useToast } from '../ui/Toast';

type Mode = 'login' | 'register' | 'forgot' | 'verify';

export const AuthModal = ({ onClose }: { onClose: () => void }) => {
  const { login, register, sendPasswordReset, resendVerification, user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  // Адрес, на который была выслана ссылка подтверждения. В режиме verify поля
  // email нет, поэтому повторная отправка должна знать адрес из сессии, иначе
  // уходит письмо без пользователя и кнопка молча ничего не делает.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Метка обновления таймера лимита: сама метка не нужна, но её изменение
  // перерисовывает окно, чтобы счётчик обратного отсчёта шёл.
  const [, setCooldownTick] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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

  // Счётчик обратного отсчёта для повторной отправки письма подтверждения.
  // Зависит от submitting: после завершения отправки метка в localStorage уже
  // обновлена, и счётчик подхватывает новое значение.
  useEffect(() => {
    if (mode !== 'verify') return;
    const target = verifyEmail ?? user?.email;
    if (!target) return;
    const tick = () => setCooldownLeft(getVerificationCooldownLeft(target));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mode, verifyEmail, user?.email, submitting]);

  const formatCooldown = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes > 0 ? `${minutes} мин ${String(seconds).padStart(2, '0')} с` : `${seconds} с`;
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
    setValidationErrors([]);
  };

  // Возвращает список ошибок валидации; пустой массив означает, что данные корректны.
  // Ошибки возвращаются значением, а не читаются из state — иначе React ещё не
  // применил бы setValidationErrors и в сообщение попала бы пустая строка.
  const validateForm = (
    data: LoginFormData | RegisterFormData | ForgotFormData,
  ): string[] => {
    if (mode === 'login') {
      const result = loginSchema.safeParse(data as LoginFormData);
      return result.success ? [] : result.error.issues.map((issue) => issue.message);
    }
    if (mode === 'forgot') {
      const result = forgotSchema.safeParse(data as ForgotFormData);
      return result.success ? [] : result.error.issues.map((issue) => issue.message);
    }
    if (mode === 'register') {
      const result = registerSchema.safeParse(data as RegisterFormData);
      return result.success ? [] : result.error.issues.map((issue) => issue.message);
    }
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      const formData = { email, password, confirmPassword, agreeTerms, agreePrivacy };
      const issues = validateForm(formData);
      setValidationErrors(issues);
      if (issues.length > 0) {
        setError(issues.join(', '));
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
        // Порядок важен: сначала показываем экран подтверждения, потом разрешаем
        // нажатия. Иначе повторная отправка уходит до появления экрана, а нажатие
        // на кнопку до этого момента не видно пользователю.
        setVerifyEmail(email);
        setMode('verify');
        setSubmitting(false);
      }
    } catch (err: any) {
      if (err.code === EMAIL_NOT_VERIFIED_CODE) {
        // Аккаунт существует и пароль верный — предлагаем подтвердить почту повторно.
        setVerifyEmail(user?.email ?? email);
        setMode('verify');
        setSubmitting(false);
        return;
      }
      const msg =
        err.code === 'auth/email-already-in-use'
          ? 'Пользователь с таким email уже зарегистрирован'
          : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Неверный email или пароль'
          : err.code === 'auth/invalid-email'
          ? 'Некорректный email'
          : err.code === 'auth/too-many-requests'
          ? 'Слишком много попыток. Попробуйте позже'
          : err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Неверный email или пароль'
          : err.code === 'auth/user-disabled'
          ? 'Этот аккаунт отключён'
          : err.code === 'auth/account-exists-with-different-credential'
          ? 'На этот email уже зарегистрирован другой способ входа'
          : err.code === 'auth/network-request-failed'
          ? 'Нет подключения к интернету'
          : err.code === 'auth/weak-password'
          ? 'Пароль слишком короткий'
          : err.code === 'auth/requires-recent-login'
          ? 'Для безопасности войдите снова'
          : err.code === 'auth/popup-closed-by-user'
          ? 'Вход отменён'
          : err.code === 'auth/cancelled-popup-request'
          ? 'Другое окно входа занято'
          : err.code === 'auth/operation-not-allowed'
          ? 'Вход по email не включён в проекте Firebase'
          : err.code === 'auth/invalid-credential'
          ? 'Неверный email или пароль'
          : err.message || 'Ошибка';
      toastError('Ошибка авторизации', msg);
      setSubmitting(false);
    }
  };

  // Экран подтверждения не поднимает красную плашку тоста: и успех, и ошибка
  // остаются в самом окне, чтобы не мигало уведомление поверх модалки.
  const handleResend = async () => {
    // Убираем прошлый результат, но не сам адрес: setSuccess заменяет сообщение.
    setError(null);
    setValidationErrors([]);
    const target = verifyEmail ?? user?.email ?? email;
    if (!target) {
      setMode('login');
      setError('Введите email и пароль, чтобы отправить письмо ещё раз');
      return;
    }
    const left = cooldownLeft;
    if (left > 0) {
      setError(`Письмо уже отправлено. Повторить можно через ${formatCooldown(left)}.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await resendVerification(target, password || undefined);
      setVerifyEmail(target);
      setMode('verify');
      setSuccess(result.message);
      // Лимит отсчитывается от фактической отправки, а не от нажатия:
      // неудачная попытка не должна блокировать кнопку на минуту.
      setCooldownTick(Date.now());
    } catch (err: any) {
      if (err.code === EMAIL_NOT_VERIFIED_CODE) {
        setVerifyEmail(target);
        setMode('verify');
        setSuccess(`Письмо отправлено на ${target}. Проверьте «Входящие» и «Спам».`);
        return;
      }
      setError(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Неверный пароль'
          : err.code === 'auth/too-many-requests'
          ? 'Слишком много попыток. Попробуйте позже'
          : err.code === 'auth/invalid-email'
          ? 'Некорректный email'
          : err.code === 'auth/network-request-failed'
          ? 'Нет подключения к интернету'
          : (err.code === EMAIL_NOT_SENT_CODE && err.message) || err.message || 'Ошибка отправки',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      onClick={(e) => {
        // Закрываем окно только нажатием по самому фону: всплытие из полей
        // и кнопок раньше доходило до оверлея и обрывало авторизацию.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-card" role="dialog" aria-modal="true">
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
            {verifyEmail && <p className="auth-hint">Адрес: {verifyEmail}</p>}
            <button className="auth-btn" onClick={handleResend} disabled={submitting || cooldownLeft > 0}>
              {submitting
                ? 'Отправка...'
                : cooldownLeft > 0
                ? `Повторить через ${formatCooldown(cooldownLeft)}`
                : 'Отправить повторно'}
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
                <label htmlFor="auth-email">Email</label>
                <input
                  type="email"
                  required
                  id="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            )}
            {mode === 'forgot' && (
              <div className="auth-field">
                <label htmlFor="auth-email">Email для восстановления</label>
                <input
                  type="email"
                  required
                  id="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <p className="auth-hint">На этот адрес придет ссылка для сброса пароля</p>
              </div>
            )}
            {(mode === 'login' || mode === 'register') && (
              <div className="auth-field">
                <label htmlFor="auth-password">Пароль</label>
                <input
                  type="password"
                  required
                  id="auth-password"
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
                <label htmlFor="auth-confirm-password">Подтвердите пароль</label>
                <input
                  type="password"
                  required
                  id="auth-confirm-password"
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
  const { user, uid, isAdmin, isAuthenticated, logout, scheduleAccountDeletion } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [scheduled, setScheduled] = useState(() => getScheduledDeletion(uid));
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (!uid) return null;
    try {
      return localStorage.getItem(`denegnyj_put_avatar_${uid}`) || null;
    } catch {
      return null;
    }
  });
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void import('../lib/firestore').then(({ loadUserAvatar }) =>
      loadUserAvatar(uid).then((value) => {
        if (!cancelled) setAvatar(value);
      }),
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [uid]);

  if (!isAuthenticated) {
    return null;
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uid) return;
    setAvatarSaving(true);
    try {
      const { prepareAvatar } = await import('../lib/avatar');
      const dataUrl = await prepareAvatar(file);
      const { saveUserAvatar } = await import('../lib/firestore');
      await saveUserAvatar(uid, dataUrl);
      setAvatar(dataUrl);
      toastSuccess('Фото обновлено', 'Аватар сохранён в профиле');
    } catch (err) {
      toastError('Не удалось сохранить фото', err instanceof Error ? err.message : 'Попробуйте другое изображение');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleAnalytics = () => {
    onClose();
    onAnalytics?.();
  };

  // Удаление ставится в очередь: пароль проверяется сразу, а данные стираются
  // после срока восстановления, чтобы ошибку можно было отменить.
  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      const result = await scheduleAccountDeletion(deletePassword);
      const record = { uid: uid ?? '', email: result.email, requestedAt: new Date().toISOString(), deleteAt: result.deleteAt };
      setScheduled(record);
      setDeleteMode(false);
      setDeletePassword('');
      setDeleteConfirmation('');
      toastSuccess(
        'Удаление запланировано',
        `Аккаунт удалится ${formatDeletionDate(result.deleteAt)}. До этой даты вход работает и удаление можно отменить.`,
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Не удалось запланировать удаление аккаунта',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDeletion = () => {
    cancelScheduledDeletion(uid ?? '');
    setScheduled(null);
    toastSuccess('Удаление отменено', 'Аккаунт и все данные остаются на месте.');
  };

  return (
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="auth-title">Аккаунт</h2>
        <div className="account-info">
          <button
            type="button"
            className="account-avatar-btn"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarSaving}
            aria-label={avatar ? 'Изменить фото профиля' : 'Добавить фото профиля'}
            title={avatar ? 'Изменить фото' : 'Добавить фото'}
          >
            <AvatarImage src={avatar} />
            <span className="account-avatar-edit" aria-hidden="true">✎</span>
          </button>
          <span className="account-email">{user?.email}</span>
          <span className="account-avatar-hint">
            {avatarSaving ? 'Сохранение фото…' : avatar ? 'Нажмите на фото, чтобы изменить' : 'Нажмите на аватар, чтобы добавить фото'}
          </span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            aria-label="Выбрать фото профиля"
            onChange={handleAvatarChange}
            hidden
          />
          {isAdmin && (
            <span className="account-badge">Администратор</span>
          )}
        </div>
        {scheduled && !deleteMode && (
          <div className="account-deletion-banner" role="status">
            <p className="account-deletion-banner-title">
              Удаление запланировано на {formatDeletionDate(scheduled.deleteAt)}
            </p>
            <p className="account-deletion-banner-text">
              Осталось дней: {deletionDaysLeft(scheduled)}. До этой даты данные сохраняются,
              вход работает, а удаление можно отменить.
            </p>
            <button className="account-action-btn" type="button" onClick={handleCancelDeletion}>
              Отменить удаление
            </button>
          </div>
        )}
        {!deleteMode ? (
          <div className="account-menu-actions">
            <button className="account-action-btn" onClick={handleLogout}>
              Выйти
            </button>
            {isAdmin && (
              <button className="account-action-btn" onClick={handleAnalytics}>
                Аналитика
              </button>
            )}
            <button
              className="account-action-btn account-delete-btn"
              onClick={() => setDeleteMode(true)}
            >
              Удалить аккаунт
            </button>
          </div>
        ) : (
          <form className="account-delete-form" onSubmit={handleDeleteAccount}>
            <p>
              Удаление запустится не сразу: данные сохраняются ещё 7 дней, и всё это время
              вход работает. По истечении срока аккаунт удалится при следующем входе.
              Сначала скачайте архив, если хотите сохранить данные.
            </p>
            <label>
              Пароль аккаунта
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                required
              />
            </label>
            <label>
              Для подтверждения введите УДАЛИТЬ
              <input
                type="text"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                required
              />
            </label>
            {deleteError && <p className="auth-error" role="alert">{deleteError}</p>}
            <div className="account-actions">
              <button
                type="button"
                className="account-action-btn"
                onClick={() => {
                  setDeleteMode(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="account-action-btn account-delete-btn"
                disabled={deleting || !deletePassword || deleteConfirmation !== 'УДАЛИТЬ'}
              >
                {deleting ? 'Планирование…' : 'Запланировать удаление'}
              </button>
            </div>
          </form>
        )}
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
        const { getAllUsers } = await import('../lib/firestore');
        const data = await getAllUsers(uid);
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
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

const AvatarImage = ({ src }: { src: string | null }) =>
  src ? <img className="account-avatar" src={src} alt="Фото профиля" /> : <UserAvatarIcon />;

const UserAvatarIcon = () => (
  <svg className="account-avatar" viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="acctAvatar" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="12" fill="url(#acctAvatar)" />
    <circle cx="12" cy="9.3" r="3.9" fill="#ffffff" />
    <path d="M4.6 20.1a7.6 7.6 0 0 1 14.8 0 12 12 0 0 1-14.8 0Z" fill="#ffffff" />
  </svg>
);

export const AccountButton = ({ onOpen }: { onOpen: () => void }) => {
  const { isAuthenticated } = useAuth();

  return (
    <button className="account-btn" onClick={onOpen} aria-label="Аккаунт">
      <UserAvatarIcon />
      {isAuthenticated && <span className="account-dot" aria-hidden="true" />}
    </button>
  );
};
