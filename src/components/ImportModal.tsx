import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  loadFromFirestore,
  COLLECTIONS,
} from '../lib/firestore';
import { loadBudgetPlan } from '../lib/budget';

export const ImportModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const userId = user?.uid;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!userId) {
      setError('Нужно войти в аккаунт');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [assets, liabilities, income, incomeArchive, budgetPlan] =
        await Promise.all([
          loadFromFirestore(COLLECTIONS.assets, userId),
          loadFromFirestore(COLLECTIONS.liabilities, userId),
          loadFromFirestore(COLLECTIONS.income, userId),
          loadFromFirestore(COLLECTIONS.incomeArchive, userId),
          loadBudgetPlan(userId),
        ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        userId,
        userEmail: user?.email ?? '',
        assets,
        liabilities,
        income,
        incomeArchive,
        budgetPlan,
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denegnyj_put_${userId}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка скачивания данных');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 className="auth-title">Скачать данные</h2>

        {!userId && (
          <div style={{ padding: 20, textAlign: 'center', color: '#dc2626' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Вход в аккаунт необходим
            </div>
            <div style={{ fontSize: 14 }}>
              Войдите в аккаунт, чтобы скачать свои данные
            </div>
          </div>
        )}

        {userId && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="auth-btn"
              style={{ width: 'fit-content', padding: '12px 24px' }}
            >
              {loading ? 'Готовим файл…' : 'Скачать данные'}
            </button>
            {error && (
              <div className="auth-error">{error}</div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#374151' }}>
            Что включается в файл:
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#64748b', fontSize: 13 }}>
            <li style={{ marginBottom: 4 }}>Активы</li>
            <li style={{ marginBottom: 4 }}>Пассивы</li>
            <li style={{ marginBottom: 4 }}>Доход</li>
            <li style={{ marginBottom: 4 }}>Доходы архив</li>
            <li style={{ marginBottom: 4 }}>План бюджета</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
