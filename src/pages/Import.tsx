import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../ui/Toast';
import { MenuIcon } from '../components/MenuIcons';
import { PageTitleContext } from '../components/PageTitleContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { loadLocalCollection } from '../lib/dataStore';
import {
  BACKUP_COLLECTIONS,
  exportBackup,
  restoreBackup,
  restoreBackupLocally,
  parseBackupFile,
  backupFileName,
  downloadBackup,
  type BackupArchive,
  type RestoreReport,
} from '../lib/backup';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function countCollections(collections: BackupArchive['collections']): number {
  return Object.values(collections).reduce((sum, list) => sum + (list?.length ?? 0), 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function Import() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { isAuthenticated, isAuthReady, uid } = useAuth();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<BackupArchive | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [clearBeforeRestore, setClearBeforeRestore] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [restored, setRestored] = useState(false);
  const [lastExport, setLastExport] = useState<{ name: string; records: number } | null>(null);

  const localCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (BACKUP_COLLECTIONS as string[]).forEach((name) => {
      counts[name] = loadLocalCollection<{ id: string }>(name, uid).length;
    });
    return counts;
  }, [uid, restored]);

  const localTotal = Object.values(localCounts).reduce((sum, value) => sum + value, 0);

  // Заголовок шапки живёт в общем контексте: без явной установки на странице
  // импорта остаётся подпись предыдущего раздела, например «Доходы».
  useEffect(() => {
    setPageTitle('Импорт и экспорт');
  }, [setPageTitle]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => setRestored(false), 5000);
    return () => window.clearTimeout(timer);
  }, [restored]);

  const handleCreateArchive = async () => {
    if (!uid) {
      // Сессия Firebase восстанавливается асинхронно: до её готовности uid ещё пуст,
      // и «нужен вход» показывался бы вошедшему пользователю.
      toastError(
        isAuthReady ? 'Нужен вход' : 'Сессия восстанавливается',
        isAuthReady
          ? 'Войдите в аккаунт, чтобы скачать данные из облака.'
          : 'Подождите пару секунд и нажмите ещё раз.',
      );
      return;
    }
    setCreating(true);
    setLastExport(null);
    try {
      const archive = await exportBackup(uid);
      const fileName = backupFileName(archive.userId);
      downloadBackup(archive, fileName);
      const records = countCollections(archive.collections);
      setLastExport({ name: fileName, records });
      toastSuccess('Архив скачан', `Записей: ${records}`);
    } catch (err) {
      toastError('Ошибка архива', err instanceof Error ? err.message : 'Не удалось создать архив');
    } finally {
      setCreating(false);
    }
  };

  const acceptFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toastError('Слишком большой файл', `Лимит — ${formatBytes(MAX_FILE_BYTES)}. Выбран ${formatBytes(file.size)}.`);
      return;
    }
    try {
      const archive = await parseBackupFile(file);
      setPendingArchive(archive);
      setPendingFileName(file.name);
      setConfirmOpen(true);
    } catch (err) {
      toastError('Ошибка файла', err instanceof Error ? err.message : 'Не удалось прочитать архив');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await acceptFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await acceptFile(file);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPendingArchive(null);
    setPendingFileName('');
    setClearBeforeRestore(false);
  };

  const handleRestore = async () => {
    if (!pendingArchive) return;
    setConfirmOpen(false);
    setRestoring(true);
    try {
      let report: RestoreReport;
      if (uid) {
        report = await restoreBackup(pendingArchive, uid);
      } else {
        report = restoreBackupLocally(pendingArchive, clearBeforeRestore);
      }
      setRestored(true);
      toastSuccess('Данные восстановлены', `Записей: ${report.totalRecords}. Обновите страницу.`);
    } catch (err) {
      toastError('Ошибка восстановления', err instanceof Error ? err.message : 'Не удалось восстановить данные');
    } finally {
      setRestoring(false);
      setPendingArchive(null);
      setPendingFileName('');
      setClearBeforeRestore(false);
    }
  };

  const pendingRecords = pendingArchive ? countCollections(pendingArchive.collections) : 0;
  const sameAccount = Boolean(pendingArchive && uid && pendingArchive.userId === uid);

  return (
    <div className="page page-budget page-import">
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Импорт и экспорт</h1>
        <p className="budget-page-subtitle">
          Резервная копия всех данных и восстановление из архива
        </p>
      </div>

      <div className="import-grid">
        <section className="import-card">
          <header className="import-card-head">
            <span className="import-card-icon" aria-hidden="true">
              <MenuIcon name="export" />
            </span>
            <div>
              <h2 className="import-card-title">Экспорт</h2>
              <p className="import-card-text">
                JSON-файл с активами, пассивами, доходами, архивом и планом бюджета.
              </p>
            </div>
          </header>

          <dl className="import-meta">
            <div>
              <dt>Источник</dt>
              <dd>{isAuthenticated ? 'облако аккаунта' : 'гостевые данные'}</dd>
            </div>
            {isAuthenticated && (
              <div>
                <dt>Записей на устройстве</dt>
                <dd>{localTotal}</dd>
              </div>
            )}
          </dl>

          <div className="import-actions">
            <button
              className="import-primary-btn"
              type="button"
              onClick={handleCreateArchive}
              disabled={creating}
            >
              {creating ? 'Создание архива…' : 'Скачать архив'}
            </button>
            {!isAuthenticated && (
              <p className="import-hint">
                Экспорт из облака доступен после входа.{' '}
                <button type="button" className="import-link-btn" onClick={() => navigate('/')}>
                  Войти на главной
                </button>
              </p>
            )}
          </div>

          {lastExport && (
            <p className="import-success" role="status">
              Файл <strong>{lastExport.name}</strong> · записей: {lastExport.records}
            </p>
          )}
        </section>

        <section className="import-card">
          <header className="import-card-head">
            <span className="import-card-icon" aria-hidden="true">
              <MenuIcon name="import" />
            </span>
            <div>
              <h2 className="import-card-title">Импорт</h2>
            </div>
          </header>

          <div
            className={`import-dropzone${dragActive ? ' import-dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Выбрать или перетащить файл архива"
          >
            <span className="import-dropzone-icon" aria-hidden="true">
              <MenuIcon name="archive" />
            </span>
            <span className="import-dropzone-title">
              {dragActive ? 'Отпустите файл' : 'Перетащите архив или нажмите'}
            </span>
            <span className="import-dropzone-hint">Формат .json · до {formatBytes(MAX_FILE_BYTES)}</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="import-file-input"
            onChange={handleFileChange}
          />

          <label className="import-switch">
            <input
              type="checkbox"
              checked={clearBeforeRestore}
              onChange={(e) => setClearBeforeRestore(e.target.checked)}
              disabled={isAuthenticated}
            />
            <span>
              <strong>Очистить текущие данные перед импортом</strong>
              <small>
                {isAuthenticated
                  ? 'В аккаунте записи объединяются по ID — очистка недоступна.'
                  : 'Только для гостевого режима: текущие данные на устройстве будут удалены.'}
              </small>
            </span>
          </label>

          {restoring && <p className="import-hint" role="status">Восстановление данных…</p>}
        </section>
      </div>

      {restored && (
        <div className="import-banner" role="status">
          <span>Данные восстановлены. Обновите страницу, чтобы увидеть изменения.</span>
          <button type="button" className="import-link-btn" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </div>
      )}

      {pendingArchive && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={closeConfirm}
          onConfirm={handleRestore}
          title="Восстановить из архива?"
          description={[
            `Файл: ${pendingFileName}.`,
            `Архив от ${formatDate(pendingArchive.createdAt)}, записей: ${pendingRecords}.`,
            pendingArchive.budgetPlan ? 'План бюджета будет восстановлен.' : 'Плана бюджета в архиве нет.',
            clearBeforeRestore && !uid
              ? 'Текущие локальные данные будут очищены.'
              : sameAccount
                ? 'Записи с теми же ID обновятся, остальные добавятся.'
                : 'Архив создан для другого аккаунта: данные объединятся с текущими по ID.',
          ].join(' ')}
          confirmLabel="Восстановить"
          confirmVariant={clearBeforeRestore && !uid ? 'danger' : 'primary'}
        />
      )}
    </div>
  );
}
