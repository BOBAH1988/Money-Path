import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  exportBackup,
  restoreBackup,
  restoreBackupLocally,
  parseBackupFile,
  backupFileName,
  type BackupArchive,
  type RestoreReport,
} from '../lib/backup';


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

export default function Import() {
  const { isAuthenticated, uid } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
      const archive = await parseBackupFile(file);
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
        const report = restoreBackupLocally(pendingArchive, clearBeforeRestore);
        toastSuccess('Данные восстановлены', `Восстановлено записей: ${report.totalRecords}. Обновите страницу, чтобы увидеть изменения.`);
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
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={clearBeforeRestore} onChange={(e) => setClearBeforeRestore(e.target.checked)} />Очистить локальные данные перед импортом (в гостевом режиме)</label>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="btn-add-item" type="button" onClick={() => fileInputRef.current?.click()} disabled={restoring}>{restoring ? 'Восстановление…' : 'Выбрать файл архива'}</button>
        </div>
      </div>
      {restored && <div className="budget-card"><div className="budget-card-body" style={{ color: 'var(--dp-color-success, #059669)', fontWeight: 600 }}>Данные восстановлены. Обновите страницу.</div></div>}
      {pendingArchive && <ConfirmDialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setPendingArchive(null); setClearBeforeRestore(false); }} onConfirm={handleRestore} title="Восстановить из архива?" description={`Архив от ${formatDate(pendingArchive.createdAt)}. Записей: ${countCollections(pendingArchive.collections)}. ${(clearBeforeRestore && !uid) ? 'Текущие локальные данные будут очищены.' : 'Данные будут объединены (записи с теми же ID обновятся).'}`} confirmLabel="Восстановить" confirmVariant={clearBeforeRestore ? 'danger' : 'primary'} />}
    </div>
  );
}
