import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { COLLECTIONS } from '../lib/dataStore';
import { loadFromFirestore } from '../lib/firestore';
import { loadBudgetPlan } from '../lib/budget';

export const ImportModal = ({ onClose }: { onClose: () => void }) => {
  const { user, uid } = useAuth();
  const userId = uid;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importModalRef = useRef<HTMLDivElement | null>(null);
  const previousImportActive = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousImportActive.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    importModalRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
      if (previousImportActive.current) previousImportActive.current.focus();
    };
  }, [onClose]);

  const handleExport = async () => {
    setError(null);
    if (!user || !userId) {
      setError('Войдите в аккаунт, чтобы экспортировать данные.');
      return;
    }
    setLoading(true);
    try {
      const [assets, liabilities, income, incomeArchive, budget] = await Promise.all([
        loadFromFirestore<{ id: string }>(COLLECTIONS.assets, userId),
        loadFromFirestore<{ id: string }>(COLLECTIONS.liabilities, userId),
        loadFromFirestore<{ id: string }>(COLLECTIONS.income, userId),
        loadFromFirestore<{ id: string }>(COLLECTIONS.incomeArchive, userId),
        loadBudgetPlan(userId),
      ]);

      const payload = {
        format: 'denegnyj_put_export_v1',
        exportedAt: new Date().toISOString(),
        userId,
        email: user.email ?? '',
        data: {
          assets,
          liabilities,
          income,
          incomeArchive,
          budgetPlan: budget,
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denegnyj_put_${userId}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось экспортировать данные');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose} aria-hidden="true">
      <div
        className="auth-card"
        ref={importModalRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <button className="auth-close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="import-title">Импорт</h2>
        <p className="auth-text">
          Экспортируйте текущие данные (активы, пассивы, доходы, архив, план бюджета) в файл JSON для переноса или резервной копии.
        </p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="auth-form">
          <button type="button" className="auth-btn" onClick={handleExport} disabled={loading}>
            {loading ? 'Экспорт...' : 'Экспортировать данные (JSON)'}
          </button>
        </div>
      </div>
    </div>
  );
};
