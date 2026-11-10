import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../ui/Toast';
import { PageTitleContext } from '../components/PageTitleContext';
import Layout from './Layout';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('denegnyj_put_theme');
});

describe('Layout: тёмная тема', () => {
  const renderLayout = () =>
    render(
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <PageTitleContext.Provider value={{ pageTitle: '', setPageTitle: () => {} }}>
              <Layout />
            </PageTitleContext.Provider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    );

  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /Меню навигации/ }));
  const pickDark = () => fireEvent.click(screen.getByRole('button', { name: /Темная/ }));
  const pickLight = () => fireEvent.click(screen.getByRole('button', { name: /Светлая/ }));

  it('добавляет класс dark при выборе тёмной темы', () => {
    renderLayout();
    openMenu();
    pickDark();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('убирает класс dark при выборе светлой темы', () => {
    renderLayout();
    openMenu();
    pickDark();
    openMenu();
    pickLight();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('светлая тема по умолчанию не имеет класса dark', () => {
    renderLayout();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('reserves scroll space for the full fixed bottom navigation', () => {
    const { container } = renderLayout();
    const bottomNav = container.querySelector<HTMLElement>('.bottom-nav');
    const layout = container.querySelector<HTMLElement>('.layout');
    expect(bottomNav).not.toBeNull();
    expect(layout).not.toBeNull();

    bottomNav!.getBoundingClientRect = () => ({
      width: 400,
      height: 210,
      top: 0,
      right: 400,
      bottom: 210,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent(window, new Event('resize'));

    expect(layout!.style.getPropertyValue('--bottom-nav-height')).toBe('226px');
  });
});
