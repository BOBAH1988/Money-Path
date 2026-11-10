import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const scheduleIdle = (fn: () => void) => {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2500 });
  else setTimeout(fn, 1200);
};

// При появлении интернета синхронизируем pending-данные с Firestore.
let onlineSyncTimer: ReturnType<typeof setTimeout> | null = null;
const triggerOnlineSync = () => {
  if (onlineSyncTimer) return;
  scheduleIdle(() => {
    void Promise.all([import('./lib/firebase'), import('./lib/firestore')])
      .then(([{ auth }, { syncPendingToFirestore }]) => {
        const userId = auth?.currentUser?.uid;
        if (userId) return syncPendingToFirestore(userId);
      })
      .catch((err) => console.error('[firestore] online sync ошибка:', err))
      .finally(() => {
        onlineSyncTimer = setTimeout(() => {
          onlineSyncTimer = null;
        }, 30000);
      });
  });
};
window.addEventListener('online', triggerOnlineSync);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((err) => console.error('[pwa] Не удалось зарегистрировать service worker:', err));
  }, { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

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
