import { NavLink, Outlet } from 'react-router-dom';

const items = [
  { to: '/', label: 'Дашборд' },
  { to: '/transactions', label: 'Транзакции' },
  { to: '/categories', label: 'Категории' },
  { to: '/budget', label: 'Бюджет' },
  { to: '/liabilities', label: 'Пассивы' },
  { to: '/import', label: 'Импорт' },
];

export default function Layout() {
  return (
    <div className="layout">
      <main className="content"><Outlet /></main>
      <nav className="bottom-nav">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => isActive ? 'active' : ''}>
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
