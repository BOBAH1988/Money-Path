import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

// Автоматически удаляем старые регистрации Service Worker и кэш
// при каждой загрузке, чтобы изменения в коде сразу вступали в силу
// без ручной очистки браузера. IndexedDB Firebase не трогаем —
// он нужен для хранения сессии авторизации и офлайн-кэша Firestore.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if (registrations.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[PWA] Старые Service Workers и кэш очищены');
      }
    } catch {
      // ignore
    }
  });
}

// Регистрация Service Worker для офлайн-работы PWA (только в продакшене).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swPath = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}sw.js` : '/sw.js';
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swPath)
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('[PWA] Service Worker зарегистрирован');
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[PWA] Ошибка регистрации Service Worker:', err);
      });
  });
}

// При появлении интернета синхронизируем pending-данные с Firestore.
let onlineSynced = false;
window.addEventListener('online', async () => {
  if (onlineSynced) return;
  onlineSynced = true;
  try {
    await syncPendingToFirestore();
  } catch {
    // ignore
  } finally {
    setTimeout(() => { onlineSynced = false; }, 30000);
  }
});

// При загрузке через 404.html fallback (GitHub Pages + BrowserRouter)
// путь хранится в хеше — восстанавливаем его в URL с базой сайта.
const hash = window.location.hash;
const base = (import.meta.env.BASE_URL || '/Money-Path/').replace(/\/+$/, '');
if (hash) {
  let route = hash.slice(1); // убрать #
  if (!route.startsWith('/')) route = '/' + route;
  window.history.replaceState(null, '', base + route);
  window.location.hash = '';
}
// Если открыли index.html напрямую — вести на корень сайта.
if (!hash && window.location.pathname.endsWith('/index.html')) {
  window.history.replaceState(null, '', base || '/');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
