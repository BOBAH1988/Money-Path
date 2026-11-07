import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncPendingToFirestore } from './lib/firestore'

// Регистрация Service Worker для офлайн-работы PWA.
if ('serviceWorker' in navigator) {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
