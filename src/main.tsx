import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

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

// Удаляем устаревшие SW/кэши, которые могли замедлять загрузку (network-first proxy, старые чанки).
// Выполняется не чаще 1 раза в час.
const cleanupLegacyServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;
  const KEY = 'denegnyj_put_sw_cleanup_v2';
  const now = Date.now();
  try {
    const last = Number(sessionStorage.getItem(KEY) || '0');
    if (now - last < 60 * 60 * 1000) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return;
    sessionStorage.setItem(KEY, String(now));
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    await clearLegacyCaches();
  } catch {
    // ignore
  }
};

const scheduleIdle = (fn: () => void) => {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2500 });
  else setTimeout(fn, 1200);
};

void cleanupLegacyServiceWorkers();

// При появлении интернета синхронизируем pending-данные с Firestore.
let onlineSyncTimer: ReturnType<typeof setTimeout> | null = null;
const triggerOnlineSync = () => {
  if (onlineSyncTimer) return;
  scheduleIdle(() => {
    void import('./lib/firestore')
      .then(({ syncPendingToFirestore }) => syncPendingToFirestore())
      .catch(() => {})
      .finally(() => {
        onlineSyncTimer = setTimeout(() => {
          onlineSyncTimer = null;
        }, 30000);
      });
  });
};
window.addEventListener('online', triggerOnlineSync);
if (navigator.onLine) triggerOnlineSync();

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
