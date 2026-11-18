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
    }).then((registration) => {
      // Оболочку кэшируем сразу после регистрации, не дожидаясь следующего
      // визита: без этого первая загрузка без сети оставляет пустой экран.
      void registration.update().catch(() => {});
    }).catch((err) => console.error('[pwa] Не удалось зарегистрировать service worker:', err));
  }, { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const appLoader = document.getElementById('app-loader');

// Долгая загрузка не должна оставлять пользователя с белым экраном и
// непонятной иконкой: через 15 секунд заменяем спиннер сообщением и кнопкой.
const loaderTimeout = window.setTimeout(() => {
  const el = document.getElementById('app-loader');
  if (!el || !el.isConnected) return;
  const text = el.querySelector('.app-loader-text');
  if (text) {
    text.textContent = navigator.onLine
      ? 'Приложение загружается дольше обычного. Проверьте интернет и нажмите «Повторить».'
      : 'Нет подключения к интернету: приложение ещё не сохранилось на устройстве.';
  }
  if (!el.querySelector('.app-loader-retry')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-loader-retry';
    button.textContent = 'Повторить';
    button.onclick = () => window.location.reload();
    el.appendChild(button);
  }
}, 15000);

const removeAppLoader = () => {
  window.clearTimeout(loaderTimeout);
  if (!appLoader) return;
  appLoader.style.opacity = '0';
  appLoader.style.transition = 'opacity 0.12s ease';
  setTimeout(() => appLoader.remove(), 130);
};

requestAnimationFrame(() => {
  requestAnimationFrame(removeAppLoader);
});
