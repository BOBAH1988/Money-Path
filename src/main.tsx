import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

// Регистрация Service Worker для офлайн-работы PWA (только в продакшене).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swPath = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}sw.js` : '/sw.js';
  navigator.serviceWorker
    .register(swPath)
    .then((registration) => {
      // eslint-disable-next-line no-console
      console.log('[PWA] Service Worker зарегистрирован');

      // При активации нового SW — перезагружаем страницу, чтобы клиент обслуживался новым SW
      // и не оставался на старых кэшированных ресурсах.
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[PWA] Ошибка регистрации Service Worker:', err);
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

// При загрузке через 404.html fallback (GitHub Pages + HashRouter)
// путь уже в хеше, роутер прочитает его сам. Восстанавливать в history не нужно.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('app-loader')?.remove();
  });
});
