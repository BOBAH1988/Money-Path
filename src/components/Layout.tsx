import { useContext, useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import packageJson from '../../package.json';
import { useBudgetPlan } from '../hooks/useBudgetPlan';
import { AppIcon } from './AppIcon';
import { AccountButton, AccountMenu, AnalyticsModal, AuthModal } from './AuthModal';
import { ImportModal } from './ImportModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageTitleProvider, PageTitleContext } from './PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { PageLoader } from './PageLoader';

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
  }, []);

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
  const { reset, loading: budgetLoading } = useBudgetPlan();
  const { error: toastError, success: toastSuccess } = useToast();
  const { isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useContext(PageTitleContext);
  const pageTitle = ctx?.pageTitle ?? '';

  if (!isAuthReady || (isAuthenticated && budgetLoading)) {
    return <PageLoader text="Загрузка данных" fullScreen />;
  }

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
      // reset из useBudgetPlan уже удаляет всю информацию из Firebase (budget_plan + коллекции),
      // поэтому не нужно дублировать очистку localStorage и Firestore вручную.
      await reset();
      toastSuccess('Данные сброшены', 'Все данные удалены и приложение перезагружено');
      setConfirmReset(false);
      window.location.reload();
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
      setConfirmReset(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
      sessionStorage.setItem('denegnyj_clear_cache', '1');
      toastSuccess('Кэш очищен', 'Перезагрузка приложения...');
      setMenuOpen(false);
      window.location.reload();
    } catch (err) {
      toastError('Ошибка кэша', err instanceof Error ? err.message : 'Не удалось очистить кэш');
      setMenuOpen(false);
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
                    Сбросить кэш
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
    </div>
    </PageTitleProvider>
  );
}
