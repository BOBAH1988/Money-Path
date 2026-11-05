import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const items = [
  { to: '/', label: 'Дашборд', icon: '📊' },
  { to: '/transactions', label: 'Транзакции', icon: '💳' },
  { to: '/categories', label: 'Категории', icon: '📁' },
  { to: '/budget', label: 'Бюджет', icon: '💰' },
  { to: '/liabilities', label: 'Пассивы', icon: '🏦' },
  { to: '/import', label: 'Импорт', icon: '📥' },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const current = items.find((i) => i.to === location.pathname);

  return (
    <div className="layout">
      <main className="content"><Outlet /></main>

      {/* Нижняя навигация PWA-стиль (кнопка меню + текущая страница) */}
      <nav className="bottom-nav">
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Меню навигации"
          aria-expanded={menuOpen}
        >
          ☰
        </button>
        <span className="current-label">{current ? current.label : ''}</span>
        <span className="menu-spacer" aria-hidden="true" />
      </nav>

      {/* Выезжающее меню поверх всего */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h2>Меню</h2>
              <button className="menu-close" onClick={() => setMenuOpen(false)}>
                Закрыть
              </button>
            </div>
            <ul className="menu-list">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="menu-icon">{i.icon}</span>
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
