import { useContext, useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import packageJson from '../../package.json';
import { AppIcon } from './AppIcon';
import { AccountButton, AccountMenu, AnalyticsModal, AuthModal } from './AuthModal';
import { ImportModal } from './ImportModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageTitleProvider, PageTitleContext } from './PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '../lib/legal';

type ConsentState = 'loading' | 'current' | 'needed' | 'error';

const pkgVersion = packageJson.version;
const currentYear = new Date().getFullYear();

const formatYearRange = (start: number, end?: number): string => {
  if (!end || end === start) return String(start);
  return `${start}-${String(end).slice(-2)}`;
};

const footerText = `Vladimir Sokolov ${formatYearRange(currentYear)}`;

const items = [
  { to: '/', label: 'Главная', icon: '📊' },
  { to: '/budget', label: 'Бюджет', icon: '💰' },
  { to: '/assets', label: 'Активы', icon: '📈' },
  { to: '/liabilities', label: 'Пассивы', icon: '🏦' },
  { to: '/income', label: 'Доходы', icon: '💵' },
  { to: '/income-archive', label: 'Архив', icon: '📂' },
];

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/budget': () => import('../pages/Budget'),
  '/assets': () => import('../pages/Assets'),
  '/liabilities': () => import('../pages/Liabilities'),
  '/income': () => import('../pages/Income'),
  '/income-archive': () => import('../pages/IncomeArchive'),
  '/import': () => import('../pages/Import'),
};

const prefetched = new Set<string>();
const prefetchRoute = (to: string) => {
  if (prefetched.has(to)) return;
  const load = routePrefetchers[to];
  if (!load) return;
  prefetched.add(to);
  void load().catch(() => prefetched.delete(to));
};



export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const themeExplicitRef = useRef(!!localStorage.getItem('denegnyj_put_theme'));
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('denegnyj_put_theme') as 'light' | 'dark' | null;
    return saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());
  const [consentState, setConsentState] = useState<ConsentState>('loading');
  const [consentForUid, setConsentForUid] = useState<string | undefined>();
  const [consentTermsChecked, setConsentTermsChecked] = useState(false);
  const [consentPrivacyChecked, setConsentPrivacyChecked] = useState(false);
  const [consentSelectionUid, setConsentSelectionUid] = useState<string>();
  const [consentError, setConsentError] = useState<string | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);
  const consentCheckId = useRef(0);

  const isInstalled = useMemo(
    () => window.matchMedia('(display-mode: standalone)').matches,
    []
  );
  const isIOS = useMemo(
    () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    []
  );
  const isMac = useMemo(
    () => /Macintosh|MacIntel|Mac_PowerPC|Mac 68K/.test(navigator.userAgent),
    []
  );
  const { error: toastError, success: toastSuccess } = useToast();
  const { isAuthenticated, isAuthReady, uid, legalConsentRevision, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useContext(PageTitleContext);
  const pageTitle = ctx?.pageTitle ?? '';

  const refreshLegalConsent = useCallback(async (userId: string) => {
    const checkId = ++consentCheckId.current;
    setConsentState('loading');
    setConsentError(null);
    try {
      const { getLegalConsent } = await import('../lib/firestore');
      const consent = await getLegalConsent(userId);
      if (checkId !== consentCheckId.current) return;
      setConsentForUid(userId);
      setConsentState(
        consent.termsVersion === TERMS_VERSION && consent.privacyVersion === PRIVACY_NOTICE_VERSION
          ? 'current'
          : 'needed',
      );
    } catch (err) {
      if (checkId !== consentCheckId.current) return;
      setConsentForUid(userId);
      setConsentState('error');
      setConsentError(err instanceof Error ? err.message : 'Не удалось проверить согласие');
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated || !uid) {
      consentCheckId.current += 1;
      setConsentForUid(undefined);
      setConsentState('current');
      return;
    }
    void refreshLegalConsent(uid);
  }, [isAuthReady, isAuthenticated, uid, legalConsentRevision, refreshLegalConsent]);

  const acceptCurrentLegalDocuments = async () => {
    if (!uid) return;
    consentCheckId.current += 1;
    setSavingConsent(true);
    setConsentError(null);
    try {
      const { recordLegalConsent } = await import('../lib/firestore');
      await recordLegalConsent(uid);
      setConsentForUid(uid);
      setConsentState('current');
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'Не удалось сохранить согласие');
    } finally {
      setSavingConsent(false);
    }
  };

  const leaveUntilConsent = async () => {
    try {
      await logout();
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'Не удалось выйти из аккаунта');
    }
  };

  useLayoutEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const check = () => {
      const buttons = Array.from(container.querySelectorAll<HTMLElement>('.bottom-nav-item'));
      const containerRect = container.getBoundingClientRect();
      const newHidden = new Set<number>();

      // Находим последнюю кнопку, которая целиком помещается в контейнер
      let lastFullyVisible = buttons.length;
      for (let i = buttons.length - 1; i >= 0; i--) {
        const rect = buttons[i].getBoundingClientRect();
        if (rect.right > containerRect.right + 1 || rect.left < containerRect.left - 1) {
          lastFullyVisible = i;
        } else {
          break;
        }
      }

      // Скрываем все кнопки от последней неполностью видимой до конца
      buttons.forEach((_btn, idx) => {
        if (idx >= lastFullyVisible) {
          newHidden.add(idx);
        }
      });

      setHiddenIndices(newHidden);
    };

    check();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(check);
      ro.observe(container);
      return () => ro.disconnect();
    }
  }, [location.pathname]);

  useEffect(() => {
    const clearFlag = sessionStorage.getItem('denegnyj_clear_cache');
    if (clearFlag) {
      sessionStorage.removeItem('denegnyj_clear_cache');
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').forEach((link) => {
        const url = new URL(link.href, window.location.origin);
        url.searchParams.set('t', Date.now().toString());
        link.href = url.href;
      });
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const promptHandler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => setDeferredPrompt(null);
    const media = window.matchMedia('(display-mode: standalone)');
    const mediaHandler = () => {};

    window.addEventListener('beforeinstallprompt', promptHandler);
    window.addEventListener('appinstalled', installedHandler);
    media.addEventListener('change', mediaHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
      media.removeEventListener('change', mediaHandler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (themeExplicitRef.current) {
      localStorage.setItem('denegnyj_put_theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (themeExplicitRef.current) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const handleConfirmReset = async () => {
    try {
      const { clearAccountData } = await import('../lib/firestore');
      const result = await clearAccountData(uid);
      toastSuccess(
        result.synced ? 'Данные сброшены' : 'Данные очищены на устройстве',
        result.synced
          ? 'Облачные данные удалены'
          : 'Удаление сохранено и будет синхронизировано при подключении к интернету',
      );
      setConfirmReset(false);
      window.location.reload();
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
      setConfirmReset(false);
    }
  };

  const handleClearCache = async () => {
    setMenuOpen(false);
    toastSuccess('Обновление приложения', 'Проверяем обновление…');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(async (reg) => {
          try { await reg.update(); } catch {}
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }));
      }
    } catch {
      // ignore; SW/controllerchange в main.tsx выполнит безопасный refresh при наличии обновления
    }
  };

  return (
    <PageTitleProvider>
      <div className="layout">
        {/* Верхняя панель приложения */}
        <header className="top-bar">
          <div className="top-bar-left">
            <AppIcon />
            <div className="app-title-block">
              <span className="app-title">Денежный путь</span>
              {pageTitle && <span className="app-subtitle">{pageTitle}</span>}
            </div>
          </div>
          <div className="top-bar-right">
            <AccountButton
              onOpen={() => {
                if (isAuthenticated) {
                  setAccountMenuOpen(true);
                } else {
                  setAuthModalOpen(true);
                }
              }}
            />
            <button
              className="menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Меню навигации"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>
        </header>

        <main className="content"><Outlet /></main>

      {/* Нижняя навигация PWA */}
      <nav className="bottom-nav">
        <div className="bottom-nav-center" ref={navRef}>
          <div className="bottom-nav-buttons">
            {items.map((item, idx) => (
              <button
                key={item.to}
                className={`bottom-nav-item ${location.pathname === item.to ? 'active' : ''} ${hiddenIndices.has(idx) ? 'hidden' : ''}`}
                onClick={() => navigate(item.to)}
                onMouseEnter={() => prefetchRoute(item.to)}
                onFocus={() => prefetchRoute(item.to)}
                onTouchStart={() => prefetchRoute(item.to)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bottom-nav-footer">
          <span className="footer-text">{footerText}</span>
          <a className="footer-link" href="mailto:79042044926@ya.ru">
            Обратная связь
          </a>
          <NavLink className="footer-link footer-legal-link" to="/terms">Условия</NavLink>
          <NavLink className="footer-link footer-legal-link" to="/privacy">Конфиденциальность</NavLink>
          <span className="footer-version">v{pkgVersion}</span>
        </div>
      </nav>

      {/* Выезжающее меню поверх всего */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h2>Меню</h2>
              <button className="menu-close" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню">
                ×
              </button>
            </div>
            <ul className="menu-list">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}
                    onClick={(e) => {
                      if (i.label === 'Импорт') {
                        e.preventDefault();
                        setImportModalOpen(true);
                      }
                      setMenuOpen(false);
                    }}
                  >
                    <span className="menu-icon">{i.icon}</span>
                    {i.label}
                  </NavLink>
                </li>
              ))}
               <li>
                  <button
                    className="menu-item menu-cache-btn"
                    onClick={handleClearCache}
                  >
                   <span className="menu-icon">🗑️</span>
                    Проверить обновления
                  </button>
                </li>
               <li>
                  <button
                    className="menu-item menu-reset-btn"
                   onClick={() => {
                     setConfirmReset(true);
                     setMenuOpen(false);
                   }}
                 >
                   <span className="menu-icon">🔄</span>
                   Сброс на стандартные
                 </button>
               </li>
               <li>
                  <button
                    className="menu-item menu-install-btn"
                    onClick={async () => {
                      setMenuOpen(false);
                      if (isInstalled) {
                        toastSuccess('Уже установлено', 'Приложение уже установлено на этом устройстве');
                        return;
                      }
                      if (isIOS) {
                        setInstallModalOpen(true);
                        return;
                      }
                      if (isMac) {
                        setInstallModalOpen(true);
                        return;
                      }
                      if (deferredPrompt) {
                        try {
                          deferredPrompt.prompt();
                          await deferredPrompt.userChoice;
                        } catch {}
                        setDeferredPrompt(null);
                        return;
                      }
                      setInstallModalOpen(true);
                    }}
                  >
                    <span className="menu-icon">📱</span>
                    Установить приложение
                  </button>
                </li>
               <li className="menu-theme-item">
                <div className="menu-theme-row">
                  <button
                    className={`menu-item menu-theme-btn ${theme === 'light' ? 'theme-active' : ''}`}
                    onClick={() => {
                      themeExplicitRef.current = true;
                      setTheme('light');
                      setMenuOpen(false);
                    }}
                    aria-label="Светлая тема"
                  >
                    Светлая
                  </button>
                  <button
                    className={`menu-item menu-theme-btn ${theme === 'dark' ? 'theme-active' : ''}`}
                    onClick={() => {
                      themeExplicitRef.current = true;
                      setTheme('dark');
                      setMenuOpen(false);
                    }}
                    aria-label="Темная тема"
                  >
                    Темная
                  </button>
                </div>
                <p className="menu-theme-label">Выбор темы</p>
              </li>
            </ul>
          </div>
        </div>
      )}

      {confirmReset && (
        <ConfirmDialog
          open={confirmReset}
          onClose={() => setConfirmReset(false)}
          onConfirm={handleConfirmReset}
          title="Сброс данных"
          description="Все ваши данные будут безвозвратно удалены. Действие необратимо."
          confirmLabel="Сбросить"
          cancelLabel="Отмена"
          confirmVariant="danger"
        />
      )}

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}

      {accountMenuOpen && (
        <AccountMenu onClose={() => setAccountMenuOpen(false)} onAnalytics={() => setAnalyticsOpen(true)} />
      )}

      {analyticsOpen && (
        <AnalyticsModal onClose={() => setAnalyticsOpen(false)} />
      )}

      {importModalOpen && <ImportModal onClose={() => setImportModalOpen(false)} />}

      {installModalOpen && (
        <div className="install-overlay" onClick={() => setInstallModalOpen(false)}>
          <div className="install-card" onClick={(e) => e.stopPropagation()}>
            <button className="install-close" onClick={() => setInstallModalOpen(false)} aria-label="Закрыть">
              ×
            </button>
            <div className="install-icon">📱</div>
            <h3 className="install-title">Установить приложение</h3>
            <p className="install-text">
              {isIOS
                ? 'Откройте страницу в Safari, нажмите кнопку «Поделиться» и выберите «На экран «Домой»».'
                : isMac
                ? isInstalled
                  ? 'Приложение уже установлено на вашем Mac.'
                  : 'В Chrome или Edge откройте меню браузера (⋮) и выберите «Установить приложение». В Safari: меню «Файл» → «Добавить в Dock».'
                : isInstalled
                ? 'Приложение уже установлено на вашем устройстве.'
                : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».'
              }
            </p>
            <div className="install-actions">
              {deferredPrompt && !isInstalled && (
                <button className="btn-install" onClick={async () => {
                  try {
                    deferredPrompt.prompt();
                    await deferredPrompt.userChoice;
                  } catch {}
                  setDeferredPrompt(null);
                  setInstallModalOpen(false);
                }}>
                  Установить
                </button>
              )}
              <button className="btn-cancel" onClick={() => setInstallModalOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      {isAuthReady && isAuthenticated && uid && (
        consentForUid !== uid || consentState !== 'current'
      ) && (
        <div className="legal-consent-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
          <div className="legal-consent-card">
            <h2 id="legal-consent-title">Документы обновлены</h2>
            {consentState === 'loading' && <p>Проверяем актуальность согласия…</p>}
            {consentState === 'error' && (
              <>
                <p role="alert">{consentError}</p>
                <p>Для проверки и сохранения согласия необходимо подключение к интернету.</p>
                <div className="legal-consent-actions">
                  <button className="btn-cancel" onClick={() => void refreshLegalConsent(uid)}>
                    Повторить
                  </button>
                  <button className="btn-cancel" onClick={() => void leaveUntilConsent()}>
                    Выйти
                  </button>
                </div>
              </>
            )}
            {consentState === 'needed' && (
              <>
                <p>
                  Чтобы продолжить пользоваться аккаунтом, ознакомьтесь с актуальными документами
                  и подтвердите согласие.
                </p>
                <p>
                  <NavLink to="/terms">Условия использования</NavLink>
                  {' · '}
                  <NavLink to="/privacy">Уведомление о конфиденциальности</NavLink>
                </p>
                <label className="legal-consent-checkbox">
                  <input
                    type="checkbox"
                    checked={consentSelectionUid === uid && consentTermsChecked}
                    onChange={(event) => {
                      setConsentSelectionUid(uid);
                      setConsentTermsChecked(event.target.checked);
                    }}
                  />
                  Принимаю текущую редакцию условий использования
                </label>
                <label className="legal-consent-checkbox">
                  <input
                    type="checkbox"
                    checked={consentSelectionUid === uid && consentPrivacyChecked}
                    onChange={(event) => {
                      setConsentSelectionUid(uid);
                      setConsentPrivacyChecked(event.target.checked);
                    }}
                  />
                  Согласен на обработку данных согласно уведомлению о конфиденциальности
                </label>
                {consentError && <p role="alert" className="auth-error">{consentError}</p>}
                <div className="legal-consent-actions">
                  <button
                    className="btn-install"
                    onClick={() => void acceptCurrentLegalDocuments()}
                    disabled={
                      savingConsent ||
                      consentSelectionUid !== uid ||
                      !consentTermsChecked ||
                      !consentPrivacyChecked
                    }
                  >
                    {savingConsent ? 'Сохраняем…' : 'Принять и продолжить'}
                  </button>
                  <button className="btn-cancel" onClick={() => void leaveUntilConsent()} disabled={savingConsent}>
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </PageTitleProvider>
  );
}
