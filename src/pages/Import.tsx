import { useCallback, useEffect, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useAuth } from '../context/AuthContext';
import {
  loadFromFirestore,
  saveToFirestore,
  loadLocalCollection,
  COLLECTIONS,
  ALL_COLLECTIONS,
} from '../lib/firestore';
import { loadBudgetPlan } from '../lib/budget';
import { useToast } from '../ui/Toast';

export default function Import() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { user } = useAuth();
  const userId = user?.uid;
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCollections, setImportedCollections] = useState<Record<string, number>>({});
  const [conflicts, setConflicts] = useState<
    Record<string, { local: number; imported: number; conflicted: number }>
  >({});
  const [importStrategy, setImportStrategy] = useState<'overwrite' | 'keep-local'>('overwrite');

  const collectionLabels: Record<string, string> = {
    assets: 'Активы',
    liabilities: 'Пассивы',
    income: 'Доходы',
    incomeArchive: 'Доходы архив',
    budget_plan: 'План бюджета',
  };

  const computeConflicts = (data: any) => {
    const result: Record<string, { local: number; imported: number; conflicted: number }> = {};
    if (!userId) return result;
    for (const collectionName of ALL_COLLECTIONS) {
      const imported = data[collectionName];
      if (!Array.isArray(imported)) continue;
      const local = loadLocalCollection<any>(collectionName, userId);
      const localById = new Map(local.map((i) => [i.id, i]));
      let conflicted = 0;
      for (const item of imported) {
        const existing = localById.get(item.id);
        if (
          existing &&
          existing.updatedAt &&
          item.updatedAt &&
          new Date(existing.updatedAt).getTime() > new Date(item.updatedAt).getTime()
        ) {
          conflicted++;
        }
      }
      if (local.length > 0 || imported.length > 0) {
        result[collectionName] = { local: local.length, imported: imported.length, conflicted };
      }
    }
    return result;
  };

  useEffect(() => {
    setPageTitle('Импорт / Экспорт данных');
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
      toastSuccess('Экспорт завершён', 'Данные сохранены в файл JSON');
    } catch (err: any) {
      const msg = err.message || 'Ошибка скачивания данных';
      setError(msg);
      toastError('Ошибка экспорта', msg);
    } finally {
      setLoading(false);
    }
  }, [userId, user, setLoading, setError, toastSuccess, toastError]);

  useEffect(() => {
    if (userId) {
      handleDownload();
    }
  }, [userId, handleDownload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportError(null);
    if (!file) {
      setParsedData(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result));
        setParsedData(data);
        setConflicts(computeConflicts(data));
        setImportStrategy('overwrite');
      } catch (err: any) {
        setImportError('Не удалось прочитать JSON-файл: ' + (err?.message ?? 'ошибка парсинга'));
        setParsedData(null);
      }
    };
    reader.onerror = () => {
      setImportError('Ошибка чтения файла');
      setParsedData(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const data = parsedData;
    if (!data) {
      setImportError('Нет данных для импорта');
      return;
    }
    if (!userId) {
      setImportError('Нужно войти в аккаунт');
      return;
    }
    setImporting(true);
    setImportError(null);
    if (importStrategy === 'keep-local') {
      setImporting(false);
      setImportError('Импорт отменён: оставлены локальные данные');
      return;
    }
    const results: Record<string, number> = {};
    try {
      for (const collectionName of ALL_COLLECTIONS) {
        const items = data[collectionName];
        if (!Array.isArray(items)) continue;
        await saveToFirestore(collectionName, items, userId);
        results[collectionName] = items.length;
      }
      // бюджет-план отдельным документом
      if (data.budgetPlan) {
        await saveToFirestore(COLLECTIONS.budgetPlan, [data.budgetPlan], userId);
        results[COLLECTIONS.budgetPlan] = 1;
      }
      setImportedCollections(results);
      toastSuccess('Импорт завершён', `Загружено коллекций: ${Object.keys(results).length}`);
    } catch (err: any) {
      const msg = err.message || 'Ошибка импорта данных';
      setImportError(msg);
      toastError('Ошибка импорта', msg);
    } finally {
      setImporting(false);
    }
  };

  const preview = parsedData ?? {};
  const hasPreview = preview && typeof preview === 'object' && Object.keys(preview).length > 0;

  return (
    <div className="page page-budget">
      <div className="budget-card">
        <div className="budget-card-body">
          <h1>Импорт / Экспорт данных</h1>
          <p style={{ marginBottom: 20, color: 'var(--theme-text-muted)' }}>
            Скачайте все ваши данные в файл JSON для резервной копии или передачи аналитику.
            Загрузите ранее сохранённый файл, чтобы восстановить данные.
          </p>

          {!userId && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--dp-color-danger)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Вход в аккаунт необходим
              </div>
              <div style={{ fontSize: 14 }}>
                Войдите в аккаунт, чтобы скачать или загрузить свои данные
              </div>
            </div>
          )}

          {userId && (
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column', marginBottom: 24 }}>
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

          <div style={{ marginTop: 24, padding: 16, background: 'var(--theme-surface)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--theme-text)' }}>
              Что включается в файл:
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--theme-text-muted)', fontSize: 13 }}>
              <li>Активы</li>
              <li>Пассивы</li>
              <li>Доход</li>
              <li>Доходы архив</li>
              <li>План бюджета</li>
            </ul>
          </div>

          {userId && (
            <div style={{ marginTop: 24, padding: 16, background: 'var(--theme-surface)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--theme-text)' }}>
                Импорт из файла JSON
              </h3>
              <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 12 }}>
                Выберите файл экспорта, ранее скачанный из этого приложения. Данные заменят текущие коллекции.
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={!userId}
                style={{
                  marginBottom: 12,
                  padding: 8,
                  border: '1px solid var(--theme-border)',
                  borderRadius: 8,
                  background: 'var(--theme-input-bg)',
                  color: 'var(--theme-text)',
                  fontSize: 13,
                  width: '100%',
                }}
              />
              {importFile && (
                <div style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 8 }}>
                  Файл: {importFile.name} ({(importFile.size / 1024).toFixed(1)} КБ)
                </div>
              )}
              {importError && (
                <div className="auth-error" style={{ marginBottom: 8 }}>{importError}</div>
              )}
              {hasPreview && !importError && (
                <div style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 12 }}>
                  Найдено коллекций:{' '}
                  {Object.keys(preview).filter((k) => ALL_COLLECTIONS.includes(k) || k === 'budgetPlan').length}
                </div>
              )}
              {Object.keys(conflicts).length > 0 && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid var(--dp-color-warning)', background: 'rgba(217, 119, 6, 0.1)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dp-color-warning)', marginBottom: 6 }}>
                    Обнаружены возможные конфликты
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--theme-text-muted)' }}>
                    {Object.entries(conflicts).map(([col, c]) => (
                      <li key={col} style={{ marginBottom: 2 }}>
                        {collectionLabels[col] || col}: локально {c.local}, в файле {c.imported},{' '}
                        {c.conflicted > 0 ? (
                          <span style={{ color: 'var(--dp-color-danger)' }}>конфликтов: {c.conflicted}</span>
                        ) : (
                          'без конфликтов'
                        )}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginRight: 12 }}>
                      <input
                        type="radio"
                        name="importStrategy"
                        value="overwrite"
                        checked={importStrategy === 'overwrite'}
                        onChange={() => setImportStrategy('overwrite')}
                      />
                      Заменить локальные данными из файла
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importStrategy"
                        value="keep-local"
                        checked={importStrategy === 'keep-local'}
                        onChange={() => setImportStrategy('keep-local')}
                      />
                      Оставить локальные данные (импорт отменён)
                    </label>
                  </div>
                </div>
              )}
              <button
                onClick={handleImport}
                disabled={importing || !hasPreview || !!importError || !userId}
                className="auth-btn"
                style={{ width: 'fit-content', padding: '12px 24px' }}
              >
                {importing ? 'Импортируем…' : 'Загрузить из файла'}
              </button>
              {Object.keys(importedCollections).length > 0 && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--dp-color-success)' }}>
                  Импортировано: {Object.entries(importedCollections).map(([c, n]) => `${c}: ${n}`).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
