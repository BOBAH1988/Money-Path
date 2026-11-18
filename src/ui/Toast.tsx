import { useCallback, useState, type ReactNode } from 'react';
import { ToastContext, type ToastType, type Toast, type ToastContextValue } from '../context/ToastContext';

const DEFAULT_DURATION = 1333;

export { useToast } from '../hooks/useToast';



interface Props {
  children: ReactNode;
}

export const ToastProvider = ({ children }: Props) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = DEFAULT_DURATION) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, type, title, message, duration };
      setToasts((prev) => {
        // Одинаковое уведомление не копится стопкой: несколько подписок на данные
        // сообщают об одном и том же сбое, и пользователь видел десяток окон.
        const duplicate = prev.find((t) => t.type === type && t.title === title && t.message === message);
        if (duplicate) return prev;
        // Больше трёх сообщений в очереди не держим — старые уходят первыми.
        const next = [...prev, toast];
        return next.slice(-3);
      });
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, message?: string, duration?: number) => addToast('success', title, message, duration),
    [addToast],
  );
  const error = useCallback(
    (title: string, message?: string, duration?: number) => addToast('error', title, message, duration),
    [addToast],
  );
  const warning = useCallback(
    (title: string, message?: string, duration?: number) => addToast('warning', title, message, duration),
    [addToast],
  );
  const info = useCallback(
    (title: string, message?: string, duration?: number) => addToast('info', title, message, duration),
    [addToast],
  );

  const value: ToastContextValue = {
    toasts,
    toast: addToast,
    success,
    error,
    warning,
    info,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="alert"
            aria-label={t.title}
          >
            <div className="toast-icon">{toastIcon(t.type)}</div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button className="toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Закрыть">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const toastIcon = (type: ToastType): string => {
  switch (type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return 'ℹ️';
  }
};
