import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

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

void cleanupLegacyServiceWorkers();

// Регистрация Service Worker отключена: для этого приложения SW давал больше проблем
// (устаревшие чанки, зависания обновления, медленный старт), чем пользы.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // no-op: оставлено как якорь; активная логика регистрации удалена.
}

// При появлении интернета синхронизируем pending-данные с Firestore.
let onlineSynced = false;
window.addEventListener('online', () => {
  if (onlineSynced) return;
  onlineSynced = true;
  void syncPendingToFirestore().catch(() => {}).finally(() => {
    setTimeout(() => { onlineSynced = false; }, 30000);
  });
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
