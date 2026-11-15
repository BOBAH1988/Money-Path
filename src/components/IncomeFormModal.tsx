import { useCallback, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { incomeArchiveSchema, type IncomeArchiveFormData } from '../lib/validation';
import type { IncomeArchiveRow } from '../pages/IncomeArchive';

const MONTHS = [
  'Янв.', 'Фев.', 'Март', 'Апр.', 'Май', 'Июн.',
  'Июл.', 'Авг.', 'Сент.', 'Окт.', 'Нояб.', 'Дек.',
];

type Mode = 'add' | 'edit';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  row?: IncomeArchiveRow | null;
  onSave: (data: IncomeArchiveFormData) => void;
  onDelete?: () => void;
}

export function IncomeFormModal({
  open,
  onClose,
  mode,
  row,
  onSave,
  onDelete,
}: Props) {
  const { success: toastSuccess, error: toastError } = useToast();
const [deleteOpen, setDeleteOpen] = useState(false);
const [submitting, setSubmitting] = useState(false);

  const initial = useMemo(() => {
    const months = row?.months ?? new Array(12).fill(0);
    return {
      name: row?.name ?? '',
      year: row?.year ?? new Date().getFullYear(),
      months: [...months],
    };
  }, [row]);

  const [form, setForm] = useState<IncomeArchiveFormData>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof IncomeArchiveFormData, string>>>({});

  const handleInputChange = useCallback(
    (key: keyof IncomeArchiveFormData, value: string) => {
      const next = { ...form, [key]: value as unknown as IncomeArchiveFormData[keyof IncomeArchiveFormData] };
      setForm(next);
      if (errors[key]) {
        setErrors((prev) => { const p = { ...prev }; delete p[key]; return p; });
      }
    },
    [form, errors]
  );

  const handleMonthChange = useCallback(
    (index: number, value: string) => {
      const v = value === '' ? 0 : Number(value.replace(/[^\d]/g, '')) || 0;
      const nextMonths = [...form.months];
      nextMonths[index] = v;
      setForm((prev) => ({ ...prev, months: nextMonths }));
      if (errors.months) {
        setErrors((prev) => { const p = { ...prev }; delete p.months; return p; });
      }
    },
    [form, errors]
  );

  const handleFillAll = useCallback(() => {
    setForm((prev) => ({ ...prev, months: prev.months.fill(form.months[0] ?? 0) }));
  }, [form.months]);

  const handleClearAll = useCallback(() => {
    setForm((prev) => ({ ...prev, months: new Array(12).fill(0) }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = incomeArchiveSchema.safeParse(form);
      if (!result.success) {
        const next: Partial<Record<keyof IncomeArchiveFormData, string>> = {};
        result.error.issues.forEach((issue) => {
          const path = issue.path[0];
          if (path !== undefined) next[path as keyof IncomeArchiveFormData] = issue.message;
        });
        setErrors(next);
        return;
      }
      setSubmitting(true);
      try {
        onSave(result.data);
        toastSuccess(
          mode === 'add' ? 'Источник добавлен' : 'Источник обновлён',
          mode === 'add'
            ? `Источник «${form.name}» добавлен`
            : `Данные источника «${form.name}» обновлены`
        );
        onClose();
      } catch (err) {
        toastError(
          'Ошибка сохранения',
          err instanceof Error ? err.message : 'Не удалось сохранить источник дохода'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [form, mode, onSave, onClose, toastSuccess, toastError]
  );

  const handleDelete = useCallback(() => {
    setDeleteOpen(false);
    onDelete?.();
    onClose();
  }, [onDelete, onClose]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} closeOnOverlayClick className="income-form-modal">
      <div className="income-form-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="income-form-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <h2 className="income-form-title">
          {mode === 'add' ? 'Новый источник дохода' : 'Редактировать источник'}
        </h2>
        <p className="income-form-subtitle">
          {mode === 'add'
            ? 'Добавьте источник дохода и укажите суммы по месяцам'
            : 'Измените название источника и суммы по месяцам'}
        </p>

        <form onSubmit={handleSubmit} className="income-form">
          <div className="income-form-section">
            <label className="income-form-label">Название источника</label>
            <Input
              label=" "
              value={form.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={errors.name}
              placeholder="Например, Зарплата"
              autoFocus
            />
            {errors.name && <span className="income-form-error">{errors.name}</span>}
          </div>

          <div className="income-form-section">
            <label className="income-form-label">Год</label>
            <Input
              label=" "
              type="number"
              min="2000"
              max="2100"
              value={String(form.year)}
              onChange={(e) => handleInputChange('year', e.target.value)}
              error={errors.year}
              placeholder="Год"
            />
            {errors.year && <span className="income-form-error">{errors.year}</span>}
          </div>

          <div className="income-form-section">
            <label className="income-form-label">Суммы по месяцам (₽)</label>
            <div className="income-months-grid">
              {MONTHS.map((label, index) => (
                <div key={index} className="income-month-cell">
                  <span className="income-month-label">{label}</span>
                  <Input
                    label=" "
                    type="text"
                    value={form.months[index] === 0 ? '' : String(form.months[index])}
                    onChange={(e) => handleMonthChange(index, e.target.value)}
                    error={errors.months}
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      placeholder: '0',
                    }}
                  />
                  {errors.months && <span className="income-form-error">{errors.months}</span>}
                </div>
              ))}
            </div>
            {errors.months && <span className="income-form-error">{errors.months}</span>}
          </div>

          <div className="income-quick-actions">
            <Button variant="secondary" size="sm" onClick={handleClearAll} disabled={submitting}>
              Очистить всё
            </Button>
            <Button variant="secondary" size="sm" onClick={handleFillAll} disabled={submitting}>
              Заполнить все
            </Button>
          </div>

          <div className="income-form-actions">
            <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            {mode === 'edit' && onDelete && (
              <Button variant="danger" size="md" onClick={() => setDeleteOpen(true)} disabled={submitting}>
                Удалить
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={submitting}
              disabled={submitting}
            >
              {mode === 'add' ? 'Добавить' : 'Сохранить'}
            </Button>
          </div>
        </form>

        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Удалить источник?"
          description="Все данные этого источника за выбранный год будут удалены безвозвратно."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          confirmVariant="danger"
        />
      </div>
    </Modal>
  );
}
