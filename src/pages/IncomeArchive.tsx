import { useEffect, useState, useMemo, useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { getIncomeArchiveMonthWindow } from '../lib/incomeArchive';
import { IncomeFormModal } from '../components/IncomeFormModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
  'Янв.', 'Фев.', 'Март', 'Апр.', 'Май', 'Июн.',
  'Июл.', 'Авг.', 'Сент.', 'Окт.', 'Нояб.', 'Дек.',
];

export interface IncomeArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const fmt = (v: number) => (v || 0).toLocaleString('ru-RU');

export default function IncomeArchive() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid } = useAuth();
  const userId = uid;
  const { success: toastSuccess } = useToast();
  const { items, loading, error, addItem, updateItem, removeItem } = useData<IncomeArchiveRow>({
    collectionName: COLLECTIONS.incomeArchive,
    userId,
  });

  useEffect(() => {
    setPageTitle('Доходы');
  }, [setPageTitle]);

  const currentYear = CURRENT_YEAR;
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return currentYear * 12 + now.getMonth() - 1;
  });
  const selectedYear = Math.floor(monthStart / 12);

  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingRow, setEditingRow] = useState<IncomeArchiveRow | null>(null);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    items.forEach((row) => {
      if (row.months.some((v) => v && v !== 0)) set.add(row.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [items, currentYear]);

  const yearItems = useMemo(() => items.filter((row) => row.year === selectedYear), [items, selectedYear]);
  const visibleMonths = useMemo(() => getIncomeArchiveMonthWindow(monthStart), [monthStart]);
  const currentMonthIndex = visibleMonths[1]?.index ?? new Date().getMonth();
  const currentMonthLabel = MONTHS[currentMonthIndex];
  const visibleRows = useMemo(
    () => yearItems.filter((row) => visibleMonths.some((month) => month.year === row.year)),
    [yearItems, visibleMonths],
  );

  const rowTotal = (row: IncomeArchiveRow) => row.months.reduce((s, v) => s + (v || 0), 0);
  const colTotal = (year: number, idx: number) =>
    items.filter((row) => row.year === year).reduce((sum, row) => sum + (row.months[idx] || 0), 0);
  const grandTotal = yearItems.reduce((s, row) => s + rowTotal(row), 0);

  const filledMonthsCount = useMemo(() => {
    const set = new Set<number>();
    yearItems.forEach((row) => row.months.forEach((v, idx) => { if (v && v !== 0) set.add(idx); }));
    return set.size;
  }, [yearItems]);
  const averageIncome = filledMonthsCount > 0 ? Math.round(grandTotal / filledMonthsCount) : 0;

  const handleRemove = (rows: IncomeArchiveRow[]) => {
    setConfirmDeleteIds(rows.map((row) => row.id));
  };

  const confirmDelete = () => {
    if (!confirmDeleteIds.length) return;
    confirmDeleteIds.forEach(removeItem);
    setConfirmDeleteIds([]);
    toastSuccess('Удалено', 'Источник удалён');
  };

  const changeWindow = (start: number) => {
    setMonthStart(start);
    setFormModalOpen(false);
    setEditingRow(null);
  };

  const prevWindow = () => changeWindow(monthStart - 1);
  const nextWindow = () => changeWindow(monthStart + 1);

  const handleAdd = () => {
    setFormMode('add');
    setEditingRow(null);
    setFormModalOpen(true);
  };

  const handleEdit = (row: IncomeArchiveRow) => {
    setFormMode('edit');
    setEditingRow(row);
    setFormModalOpen(true);
  };

  const handleSave = (data: { name: string; year: number; months: number[] }) => {
    if (formMode === 'add') {
      addItem({ name: data.name, year: data.year, months: data.months });
    } else if (editingRow) {
      updateItem(editingRow.id, { name: data.name, year: data.year, months: data.months });
    }
    setFormModalOpen(false);
    setEditingRow(null);
  };

  const handleDeleteRow = () => {
    if (!editingRow) return;
    removeItem(editingRow.id);
    setEditingRow(null);
    setFormModalOpen(false);
    toastSuccess('Удалено', 'Источник удалён');
  };

  if (error) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--dp-color-danger)' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Ошибка загрузки данных</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-text-muted)' }}>Загрузка данных</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasData = visibleRows.length > 0;

  return (
    <div className="page page-budget">
      <div className="budget-summary" style={{ margin: '0 4px 12px' }}>
        <div className="summary-item summary-item-total">
          <span className="summary-label">Итого за год</span>
          <span className="summary-value">{grandTotal.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Средний Доход</span>
          <span className="summary-value">{averageIncome.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <div className="budget-card">
        <div className="budget-card-header" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <h2 className="budget-card-title" style={{ margin: 0 }}>Доходы</h2>
            <select
              value={selectedYear}
              onChange={(e) => changeWindow(Number(e.target.value) * 12)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--theme-border)',
                background: 'var(--theme-card)',
                color: 'var(--theme-text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            <button className="btn-add btn-add-header" onClick={handleAdd} aria-label="Добавить источник">+</button>
            <button className="btn-edit" onClick={prevWindow} aria-label="Назад">◀</button>
            <button className="btn-edit" onClick={nextWindow} aria-label="Вперёд">▶</button>
          </div>
        </div>
        <div className="budget-card-body">
          <div className="budget-table-wrap">
            {!hasData && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Источников дохода нет</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>Нажмите «+», чтобы добавить первый источник</div>
              </div>
            )}
            <table className="budget-table">
              <thead>
                <tr>
                  <th className="budget-head budget-head-name">Источник</th>
                  <th className="budget-head budget-head-year">Год</th>
                  {visibleMonths.map(({ year, index }) => (
                    <th key={`${year}-${index}`} className="budget-head budget-head-amount">
                      {MONTHS[index]}<span className="archive-month-year">{year}</span>
                    </th>
                  ))}
                  <th className="budget-head budget-head-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  return (
                    <tr key={row.id} className="budget-row">
                      <td className="budget-cell budget-cell-name">
                        <span className="row-name">{row.name || '—'}</span>
                      </td>
                      <td className="budget-cell budget-cell-year">
                        <span className="row-year">{row.year}</span>
                      </td>
                      {visibleMonths.map(({ year, index }) => {
                        const matchingRow = visibleRows.find((r) => r.id === row.id && r.year === year);
                        return (
                          <td key={`${year}-${index}`} className="budget-cell budget-cell-amount">
                            <span className="row-amount">{fmt(matchingRow?.months[index] ?? 0)}</span>
                          </td>
                        );
                      })}
                      <td className="budget-cell budget-cell-actions">
                        <button className="btn-edit" onClick={() => handleEdit(row)} aria-label="Редактировать">✎</button>
                        <button className="btn-delete" onClick={() => handleRemove([row])} aria-label="Удалить">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
                {hasData && (
                  <tr className="budget-row total">
                    <td className="budget-cell budget-cell-name" colSpan={2}><span className="footer-label">Итого:</span></td>
                    {visibleMonths.map(({ year, index }) => (
                      <td key={`${year}-${index}`} className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {colTotal(year, index).toLocaleString('ru-RU')}
                      </td>
                    ))}
                    <td className="budget-cell budget-cell-actions" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IncomeFormModal
        open={formModalOpen}
        onClose={() => { setFormModalOpen(false); setEditingRow(null); }}
        mode={formMode}
        row={editingRow ?? undefined}
        onSave={handleSave}
        onDelete={handleDeleteRow}
        monthLabel={formMode === 'edit' ? currentMonthLabel : undefined}
        monthIndex={formMode === 'edit' ? currentMonthIndex : undefined}
      />

      <ConfirmDialog
        open={confirmDeleteIds.length > 0}
        onClose={() => setConfirmDeleteIds([])}
        onConfirm={confirmDelete}
        title="Удалить источник?"
        description="Все данные этого источника за отображаемые годы будут удалены безвозвратно."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
      />
    </div>
  );
}
