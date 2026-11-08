import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

// Автоматически удаляем старые регистрации Service Worker, кэш и IndexedDB Firebase
// при каждой загрузке, чтобы изменения в коде сразу вступали в силу без ручной очистки браузера.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      // Чистим IndexedDB кэш Firebase, чтобы старые данные не возвращались после перезагрузки
      if ('indexedDB' in window) {
        const dbNames = await indexedDB.databases?.() ?? [];
        for (const db of dbNames) {
          if (db.name && (db.name.includes('firestore') || db.name.includes('firebase'))) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
      if (registrations.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[PWA] Старые Service Workers, кэш и IndexedDB Firebase очищены');
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
// путь хранится в хеше — восстанавливаем его в URL без хеша.
const hash = window.location.hash;
if (hash && hash.startsWith('#/')) {
  const path = hash.slice(1); // убрать #
  window.history.replaceState(null, '', path);
  window.location.hash = '';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
