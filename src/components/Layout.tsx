import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import packageJson from '../../package.json';
import { useBudget } from '../hooks/useBudget';
import { AppIcon } from './AppIcon';

const pkgVersion = packageJson.version;

const items = [
  { to: '/', label: 'Дашборд', icon: '📊' },
  { to: '/budget', label: 'Бюджет', icon: '💰' },
  { to: '/liabilities', label: 'Пассивы', icon: '🏦' },
  { to: '/categories', label: 'Категории', icon: '📁' },
  { to: '/transactions', label: 'Транзакции', icon: '💳' },
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
  const { reset } = useBudget();

  return (
    <div className="layout">
      {/* Верхняя панель приложения */}
      <header className="top-bar">
        <div className="top-bar-left">
          <AppIcon />
          <span className="app-title">Денежный путь</span>
        </div>
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Меню навигации"
          aria-expanded={menuOpen}
        >
          ☰
        </button>
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
                      e.preventDefault();
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
                    reset();
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
    </div>
  );
}
