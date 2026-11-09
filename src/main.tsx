import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

// Регистрация Service Worker для офлайн-работы PWA (только в продакшене).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const swPath = import.meta.env.BASE_URL ? `${import.meta.env.BASE_URL}sw.js` : '/sw.js';
  const reloadKey = 'denegnyj_put_sw_reloaded';

  const clearLegacyCaches = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
  };

  const forceUpdate = async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async (reg) => {
        try { await reg.update(); } catch {}
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }));
    } catch {
      // ignore
    }
  };

  navigator.serviceWorker
    .register(swPath)
    .then(async (registration) => {
      // eslint-disable-next-line no-console
      console.log('[PWA] Service Worker зарегистрирован');
      try { await registration.update(); } catch {}

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[PWA] Ошибка регистрации Service Worker:', err);
    });

  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    // Перезагружаемся один раз, чтобы клиент подхватил новый SW/ассеты без действий пользователя.
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, '1');
    await clearLegacyCaches();
    window.location.reload();
  });

  window.addEventListener('load', () => {
    void forceUpdate();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void forceUpdate();
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

const removeAppLoader = () => {
  const el = document.getElementById('app-loader');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.12s ease';
  setTimeout(() => el.remove(), 130);
};

requestAnimationFrame(() => {
  requestAnimationFrame(removeAppLoader);
});
