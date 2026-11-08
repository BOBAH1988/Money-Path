import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import packageJson from '../../package.json';
import { useBudget } from '../hooks/useBudget';
import { clearCollectionData, cleanupResetPendingFirestore, COLLECTIONS } from '../lib/firestore';
import { AppIcon } from './AppIcon';
import { AuthModal, AccountButton, AccountMenu, AnalyticsModal } from './AuthModal';
import { ImportModal } from './ImportModal';
import { PageTitleProvider, PageTitleContext } from './PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

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
  { to: '/income-archive', label: 'Доходы архив', icon: '📂' },
  { to: '/import', label: 'Импорт', icon: '📥' },
];



export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const themeExplicitRef = useRef(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('denegnyj_put_theme') as 'light' | 'dark' | null;
    themeExplicitRef.current = !!saved;
    return saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const isInstalled = useMemo(
    () => window.matchMedia('(display-mode: standalone)').matches,
    []
  );
  const isIOS = useMemo(
    () => /iPad|iPhone|iPod/.test(navigator.userAgent),
    []
  );
  const { reset } = useBudget();
  const { error: toastError, success: toastSuccess } = useToast();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.uid ?? undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useContext(PageTitleContext);
  const pageTitle = ctx?.pageTitle ?? '';

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
      await reset(true);
      clearCollectionData(COLLECTIONS.assets, userId);
      clearCollectionData(COLLECTIONS.liabilities, userId);
      clearCollectionData(COLLECTIONS.income, userId);
      clearCollectionData(COLLECTIONS.incomeArchive, userId);
      if (userId) {
        const ok = await cleanupResetPendingFirestore(userId);
        if (!ok) {
          toastError('Ошибка сброса', 'Не удалось полностью очистить данные в облаке');
        }
      }
      toastSuccess('Данные сброшены', 'Все данные удалены и приложение перезагружено');
      setConfirmReset(false);
      window.location.reload();
    } catch (err) {
      toastError('Ошибка сброса', err instanceof Error ? err.message : 'Не удалось сбросить данные');
      setConfirmReset(false);
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
        <div className="bottom-nav-buttons">
          <button
            className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <span className="nav-icon">📊</span>
            <span>Главная</span>
          </button>
          <button
            className={`bottom-nav-item ${location.pathname === '/budget' ? 'active' : ''}`}
            onClick={() => navigate('/budget')}
          >
            <span className="nav-icon">💰</span>
            <span>Бюджет</span>
          </button>
          <button
            className={`bottom-nav-item ${location.pathname === '/assets' ? 'active' : ''}`}
            onClick={() => navigate('/assets')}
          >
            <span className="nav-icon">📈</span>
            <span>Активы</span>
          </button>
          <button
            className={`bottom-nav-item ${location.pathname === '/liabilities' ? 'active' : ''}`}
            onClick={() => navigate('/liabilities')}
          >
            <span className="nav-icon">🏦</span>
            <span>Пассивы</span>
          </button>
          <button
            className={`bottom-nav-item ${location.pathname === '/income' ? 'active' : ''}`}
            onClick={() => navigate('/income')}
          >
            <span className="nav-icon">💵</span>
            <span>Доходы</span>
          </button>
          <button
            className={`bottom-nav-item ${location.pathname === '/income-archive' ? 'active' : ''}`}
            onClick={() => navigate('/income-archive')}
          >
            <span className="nav-icon">📂</span>
            <span>Архив</span>
          </button>
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
                   className="menu-item menu-install-btn"
                   onClick={async () => {
                     setMenuOpen(false);
                     if (isIOS) {
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

      {authModalOpen && (
        <AuthModal onClose={() => setAuthModalOpen(false)} />
      )}

      {accountMenuOpen && (
        <AccountMenu onClose={() => setAccountMenuOpen(false)} onAnalytics={() => setAnalyticsOpen(true)} />
      )}

      {analyticsOpen && (
        <AnalyticsModal onClose={() => setAnalyticsOpen(false)} />
      )}

      {importModalOpen && (
        <ImportModal onClose={() => setImportModalOpen(false)} />
      )}

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
                : isInstalled
                ? 'Приложение уже установлено на вашем устройстве.'
                : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».'}
            </p>
            <div className="install-actions">
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
