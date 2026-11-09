import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { BUDGET_STORAGE_KEY } from '../lib/budget';
import { exportBackup, restoreBackup, backupFileName, type BackupArchive, type RestoreReport } from '../lib/backup';
import { ALL_COLLECTIONS, type FirestoreCollection } from '../lib/dataStore';
import { saveToFirestore } from '../lib/firestore';
import { saveBudgetPlan } from '../lib/budget';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function countCollections(collections: BackupArchive['collections']): number {
  return Object.values(collections).reduce((s, a) => s + (a?.length ?? 0), 0);
}

function readArchiveFile(file: File): Promise<BackupArchive> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!parsed || typeof parsed !== 'object') throw new Error('Некорректный JSON');
        resolve(parsed as BackupArchive);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Не удалось прочитать архив'));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file);
  });
}

export default function Import() {
  const { isAuthenticated, uid } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [localRestoring, setLocalRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<BackupArchive | null>(null);
  const [clearBeforeRestore, setClearBeforeRestore] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => setRestored(false), 3500);
    return () => window.clearTimeout(timer);
  }, [restored]);

  const handleCreateArchive = async () => {
    if (!uid) return;
    setCreating(true);
    try {
      const archive = await exportBackup(uid);
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(archive.userId);
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Архив создан', `Сохранено записей: ${countCollections(archive.collections)}`);
    } catch (err) {
      toastError('Ошибка архива', err instanceof Error ? err.message : 'Не удалось создать архив');
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const archive = await readArchiveFile(file);
      setPendingArchive(archive);
      setConfirmOpen(true);
    } catch (err) {
      toastError('Ошибка файла', err instanceof Error ? err.message : 'Не удалось прочитать архив');
    }
  };

  const handleRestore = async () => {
    if (!pendingArchive) return;
    setConfirmOpen(false);
    setRestoring(true);
    try {
      if (uid) {
        const report: RestoreReport = await restoreBackup(pendingArchive, uid);
        toastSuccess('Данные восстановлены', `Восстановлено записей: ${report.totalRecords}. Обновите страницу.`);
      } else {
        if (clearBeforeRestore) {
          for (const col of ALL_COLLECTIONS as FirestoreCollection[]) localStorage.removeItem(`denegnyj_put_${col}`);
          localStorage.removeItem(BUDGET_STORAGE_KEY());
        }
        for (const [col, items] of Object.entries(pendingArchive.collections)) {
          if (items && items.length) localStorage.setItem(`denegnyj_put_${col}`, JSON.stringify(items));
        }
        if (pendingArchive.budgetPlan?.items?.length) localStorage.setItem(BUDGET_STORAGE_KEY(), JSON.stringify(pendingArchive.budgetPlan));
        toastSuccess('Данные восстановлены', 'Обновите страницу, чтобы увидеть изменения.');
      }
      setRestored(true);
    } catch (err) {
      toastError('Ошибка восстановления', err instanceof Error ? err.message : 'Не удалось восстановить данные');
    } finally {
      setRestoring(false);
      setPendingArchive(null);
      setClearBeforeRestore(false);
    }
  };

  const handleRestoreLocal = async () => {
    if (!uid) return;
    setLocalRestoring(true);
    try {
      const collections = {} as BackupArchive['collections'];
      for (const col of ALL_COLLECTIONS as FirestoreCollection[]) {
        try { collections[col] = JSON.parse(localStorage.getItem(`denegnyj_put_${col}`) || '[]'); } catch { collections[col] = []; }
      }
      let budgetPlan = { items: [] as unknown[], updatedAt: new Date().toISOString() };
      try { const raw = localStorage.getItem(BUDGET_STORAGE_KEY()); if (raw) budgetPlan = JSON.parse(raw); } catch {}
      for (const [col, items] of Object.entries(collections)) {
        if (Array.isArray(items) && items.length) await saveToFirestore(col, items as { id: string }[], uid);
      }
      if (Array.isArray(budgetPlan.items)) await saveBudgetPlan(budgetPlan as any, uid);
      toastSuccess('Локальные данные загружены', 'Данные из браузера сохранены в аккаунт.');
      setRestored(true);
    } catch (err) {
      toastError('Ошибка', err instanceof Error ? err.message : 'Не удалось загрузить локальные данные');
    } finally {
      setLocalRestoring(false);
    }
  };

  return (
    <div className="page page-budget">
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Импорт и экспорт</h1>
        <p className="budget-page-subtitle">Резервное копирование и восстановление данных</p>
      </div>
      <div className="budget-card">
        <div className="budget-card-header"><h2 className="budget-card-title">Экспорт</h2></div>
        <div className="budget-card-body">
          <p style={{ fontSize: 14, color: 'var(--theme-text-muted)', margin: '0 0 12px' }}>Создаёт JSON-файл со всеми вашими данными (активы, пассивы, доходы, архив, план бюджета).</p>
          <button className="btn-add-item" type="button" onClick={handleCreateArchive} disabled={creating || !isAuthenticated}>{creating ? 'Создание…' : 'Скачать архив'}</button>
          {!isAuthenticated && <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginTop: 8 }}>Войдите в аккаунт, чтобы экспортировать данные из облака.</p>}
        </div>
      </div>
      <div className="budget-card">
        <div className="budget-card-header"><h2 className="budget-card-title">Импорт</h2></div>
        <div className="budget-card-body">
          <p style={{ fontSize: 14, color: 'var(--theme-text-muted)', margin: '0 0 12px' }}>Восстанавливает данные из ранее сохранённого архива.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={clearBeforeRestore} onChange={(e) => setClearBeforeRestore(e.target.checked)} />Очистить текущие данные перед импортом</label>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="btn-add-item" type="button" onClick={() => fileInputRef.current?.click()} disabled={restoring}>{restoring ? 'Восстановление…' : 'Выбрать файл архива'}</button>
        </div>
      </div>
      {isAuthenticated && (
        <div className="budget-card">
          <div className="budget-card-header"><h2 className="budget-card-title">Локальные данные → облако</h2></div>
          <div className="budget-card-body">
            <p style={{ fontSize: 14, color: 'var(--theme-text-muted)', margin: '0 0 12px' }}>Отправляет данные из локального хранилища этого браузера в ваш аккаунт.</p>
            <button className="btn-add-item" type="button" onClick={handleRestoreLocal} disabled={localRestoring}>{localRestoring ? 'Загрузка…' : 'Загрузить локальные данные'}</button>
          </div>
        </div>
      )}
      {restored && <div className="budget-card"><div className="budget-card-body" style={{ color: 'var(--dp-color-success, #059669)', fontWeight: 600 }}>Данные восстановлены. Обновите страницу.</div></div>}
      {pendingArchive && <ConfirmDialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setPendingArchive(null); setClearBeforeRestore(false); }} onConfirm={handleRestore} title="Восстановить из архива?" description={`Архив от ${formatDate(pendingArchive.createdAt)}. Записей: ${countCollections(pendingArchive.collections)}. ${clearBeforeRestore ? 'Текущие данные будут очищены.' : 'Данные будут объединены.'}`} confirmLabel="Восстановить" confirmVariant={clearBeforeRestore ? 'danger' : 'primary'} />}
    </div>
  );
}
