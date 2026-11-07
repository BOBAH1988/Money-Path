import { useState, createContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import packageJson from '../../package.json';
import { useBudget } from '../hooks/useBudget';
import { clearCollectionData, cleanupResetPendingFirestore, COLLECTIONS } from '../lib/firestore';
import { AppIcon } from './AppIcon';
import { AuthModal, AccountButton, AccountMenu, AnalyticsModal } from './AuthModal';
import { ImportModal } from './ImportModal';
import { useAuth } from '../context/AuthContext';

const pkgVersion = packageJson.version;

interface PageTitleContextValue {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

export const PageTitleContext = createContext<PageTitleContextValue | undefined>(undefined);

const items = [
  { to: '/', label: 'Главная', icon: '📊' },
  { to: '/budget', label: 'Бюджет', icon: '💰' },
  { to: '/assets', label: 'Активы', icon: '📈' },
  { to: '/liabilities', label: 'Пассивы', icon: '🏦' },
  { to: '/income', label: 'Доходы', icon: '💵' },
  { to: '/income-archive', label: 'Доходы архив', icon: '📂' },
  { to: '/import', label: 'Импорт', icon: '📥' },
];

const START_YEAR = 2026;
const currentYear = new Date().getFullYear();
const footerText =
  currentYear === START_YEAR
    ? `project by Vladimir Sokolov ${START_YEAR}`
    : `project by Vladimir Sokolov ${START_YEAR} - ${currentYear}`;

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const { reset } = useBudget();
  const { user, isAuthenticated } = useAuth();
  const userId = user?.uid ?? undefined;

  const ctxValue = { pageTitle, setPageTitle };

  return (
    <PageTitleContext.Provider value={ctxValue}>
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

      {/* Нижняя панель — copyright строка и обратная связь */}
      <nav className="bottom-nav">
        <span className="footer-text">{footerText}</span>
        <a className="footer-link" href="mailto:79042044926@ya.ru">
          Обратная связь
        </a>
        <span className="footer-version">v{pkgVersion}</span>
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
            </ul>
          </div>
        </div>
      )}

      {confirmReset && (
        <div className="confirm-overlay" onClick={() => setConfirmReset(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <p>Точно удалить все данные?</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmReset(false)}>
                Нет
              </button>
                    <button
                      className="btn-delete-confirm"
                      onClick={async () => {
                        console.log('[reset] handler started, userId:', userId);
                        setResetting(true);
                        try {
                          await reset(true);
                          clearCollectionData(COLLECTIONS.assets, userId);
                          clearCollectionData(COLLECTIONS.liabilities, userId);
                          clearCollectionData(COLLECTIONS.income, userId);
                          clearCollectionData(COLLECTIONS.incomeArchive, userId);
                          // Очищаем Firestore и проверяем результат
                          if (userId) {
                            const ok = await cleanupResetPendingFirestore(userId);
                            if (!ok) {
                              console.error('Firestore cleanup failed');
                              setConfirmReset(false);
                              setResetting(false);
                            }
                          }
                          setConfirmReset(false);
                          window.location.reload();
                        } catch (err) {
                          console.error('[reset] error:', err);
                          setConfirmReset(false);
                          setResetting(false);
                        }
                      }}
                      disabled={resetting}
                    >
                      {resetting ? 'Сброс...' : 'Да'}
                    </button>
            </div>
          </div>
        </div>
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
    </div>
      </PageTitleContext.Provider>
  );
}
