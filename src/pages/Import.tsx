import { useCallback, useEffect, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useAuth } from '../context/AuthContext';
import {
  loadFromFirestore,
  COLLECTIONS,
} from '../lib/firestore';
import { loadBudgetPlan } from '../lib/budget';

export default function Import() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { user } = useAuth();
  const userId = user?.uid;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Импорт / Экспорт');
  }, [setPageTitle]);

  const handleDownload = useCallback(async () => {
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
    } catch (err: any) {
      setError(err.message || 'Ошибка скачивания данных');
    } finally {
      setLoading(false);
    }
  }, [userId, user, setLoading, setError]);

  useEffect(() => {
    if (userId) {
      handleDownload();
    }
  }, [userId, handleDownload]);

  return (
    <div className="page page-budget">
      <div className="budget-card">
        <div className="budget-card-body">
          <h1>Импорт / Экспорт данных</h1>
          <p style={{ marginBottom: 20, color: '#64748b' }}>
            Скачайте все ваши данные в файл JSON для передачи аналитику или наставнику.
          </p>

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
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button
                onClick={handleDownload}
                disabled={loading}
                className="auth-btn"
                style={{ width: 'fit-content', padding: '12px 24px' }}
              >
                {loading ? 'Готовим файл…' : 'Скачать данные (JSON)'}
              </button>
              {error && (
                <div className="auth-error">{error}</div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#374151' }}>
              Что включается в файл:
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#64748b', fontSize: 13 }}>
              <li>Активы</li>
              <li>Пассивы</li>
              <li>Доход</li>
              <li>Доходы архив</li>
              <li>План бюджета</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
