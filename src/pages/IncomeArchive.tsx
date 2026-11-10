import { useEffect, useState, useMemo, useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { getIncomeArchiveMonthWindow } from '../lib/incomeArchive';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
  'Янв.', 'Фев.', 'Март', 'Апр.', 'Май', 'Июн.',
  'Июл.', 'Авг.', 'Сент.', 'Окт.', 'Нояб.', 'Дек.',
];

interface IncomeArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const emptyMonths = () => new Array(12).fill(0);
const emptyVisibleMonths = () => new Array(3).fill(0);

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
    setPageTitle('Доходы архив');
  }, [setPageTitle]);

  const currentYear = CURRENT_YEAR;
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return currentYear * 12 + Math.max(0, now.getMonth() - 2);
  });
  const selectedYear = Math.floor(monthStart / 12);

  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addName, setAddName] = useState('');
  const [addMonths, setAddMonths] = useState<number[]>(emptyVisibleMonths());

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
  const visibleYearItems = useMemo(
    () => items.filter((row) => visibleMonths.some((month) => month.year === row.year)),
    [items, visibleMonths],
  );
  const visibleRows = useMemo(() => {
    const groups = new Map<string, IncomeArchiveRow[]>();
    visibleYearItems.forEach((row) => {
      const key = row.name || row.id;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return Array.from(groups.values(), (rows) => ({
      key: rows[0]!.id,
      name: rows[0]?.name ?? '',
      rows,
    }));
  }, [visibleYearItems]);

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

  const updateCell = (rows: IncomeArchiveRow[], year: number, monthIdx: number, value: number) => {
    const row = rows.find((item) => item.year === year);
    if (!row) {
      const months = emptyMonths();
      months[monthIdx] = value;
      addItem({ name: rows[0]?.name ?? '', year, months });
      return;
    }
    const nextMonths = [...row.months];
    nextMonths[monthIdx] = value;
    updateItem(row.id, { months: nextMonths });
  };

  const updateName = (rows: IncomeArchiveRow[], name: string) => {
    rows.forEach((row) => updateItem(row.id, { name }));
  };

  const handleAdd = () => {
    const name = addName.trim();
    if (!name) { setShowAddRow(false); setAddName(''); setAddMonths(emptyVisibleMonths()); return; }
    const monthsByYear = new Map<number, number[]>();
    visibleMonths.forEach((month, index) => {
      const months = monthsByYear.get(month.year) ?? emptyMonths();
      months[month.index] = addMonths[index] ?? 0;
      monthsByYear.set(month.year, months);
    });
    monthsByYear.forEach((months, year) => {
      if (year === selectedYear || months.some((value) => value !== 0)) {
        addItem({ name, year, months });
      }
    });
    setAddName('');
    setAddMonths(emptyVisibleMonths());
    setShowAddRow(false);
  };

  const handleRemove = (rows: IncomeArchiveRow[]) => {
    setConfirmDeleteIds(rows.map((row) => row.id));
  };

  const confirmDelete = () => {
    if (!confirmDeleteIds.length) return;
    confirmDeleteIds.forEach(removeItem);
    setConfirmDeleteIds([]);
    toastSuccess('Удалено', 'Строка удалена');
  };

  const changeWindow = (start: number) => {
    setEditingId(null);
    setShowAddRow(false);
    setAddName('');
    setAddMonths(emptyVisibleMonths());
    setMonthStart(start);
  };

  const prevWindow = () => changeWindow(monthStart - 1);
  const nextWindow = () => changeWindow(monthStart + 1);

  const finishEdit = () => setEditingId(null);

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
            <h2 className="budget-card-title" style={{ margin: 0 }}>Доходы архив</h2>
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
            {editingId && (
              <button className="btn-edit" onClick={finishEdit} aria-label="Сохранить">✓</button>
            )}
            <button className="btn-edit" onClick={prevWindow} aria-label="Назад">◀</button>
            <button className="btn-edit" onClick={nextWindow} aria-label="Вперёд">▶</button>
          </div>
        </div>
        <div className="budget-card-body">
          <div className="budget-table-wrap">
            <table className="budget-table">
              <thead>
                <tr>
                  <th className="budget-head budget-head-name">Источник</th>
                  {visibleMonths.map(({ year, index }) => (
                    <th key={`${year}-${index}`} className="budget-head budget-head-amount">
                      {MONTHS[index]}<span className="archive-month-year">{year}</span>
                    </th>
                  ))}
                  <th className="budget-head budget-head-actions">
                    {showAddRow || editingId ? (
                    <button className="btn-done btn-done-header" onClick={() => { if (showAddRow) setShowAddRow(false); if (editingId) setEditingId(null); }} aria-label="ОК">✓</button>
                  ) : (
                    <button className="btn-add btn-add-header" onClick={() => setShowAddRow(true)} aria-label="Добавить строку">+</button>
                  )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isEditing = editingId === row.key;
                  return (
                    <tr key={row.key} className="budget-row">
                      <td className="budget-cell budget-cell-name">
                        {isEditing ? (
                          <input
                            className="budget-input"
                            value={row.name}
                            onChange={(e) => updateName(row.rows, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
                            autoFocus
                          />
                        ) : (
                          <span className="row-name">{row.name || '—'}</span>
                        )}
                      </td>
                    {visibleMonths.map(({ year, index }) => {
                      const yearRow = row.rows.find((entry) => entry.year === year);
                      return (
                        <td key={`${year}-${index}`} className="budget-cell budget-cell-amount">
                          {isEditing ? (
                            <input
                              className="budget-input budget-input-amount"
                              value={yearRow?.months[index] || ''}
                              onChange={(e) => updateCell(row.rows, year, index, Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                              onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
                            />
                          ) : (
                            <span className="row-amount">{fmt(yearRow?.months[index] ?? 0)}</span>
                          )}
                        </td>
                      );
                    })}
                      <td className="budget-cell budget-cell-actions">
                        {!isEditing && (
                          <button className="btn-edit" onClick={() => setEditingId(row.key)} aria-label="Редактировать">✎</button>
                        )}
                        {isEditing && (
                          <button className="btn-delete" onClick={() => { handleRemove(row.rows); setEditingId(null); }} aria-label="Удалить">🗑️</button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {showAddRow && (
                  <tr className="budget-row budget-row-editing">
                    <td className="budget-cell budget-cell-name">
                      <input
                        className="budget-input"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="Источник"
                        autoFocus
                      />
                    </td>
                    {visibleMonths.map(({ year, index }, visibleIndex) => (
                      <td key={`${year}-${index}`} className="budget-cell budget-cell-amount">
                        <input
                          className="budget-input budget-input-amount"
                          value={addMonths[visibleIndex] || ''}
                          onChange={(e) => {
                            const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0;
                            setAddMonths((prev) => {
                              const next = [...prev];
                              next[visibleIndex] = v;
                              return next;
                            });
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                          placeholder="0"
                        />
                      </td>
                    ))}
                      <td className="budget-cell budget-cell-actions">
                        <button className="btn-edit" onClick={handleAdd} aria-label="Сохранить">OK</button>
                      </td>
                  </tr>
                )}

                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name"><span className="footer-label">Итого:</span></td>
                  {visibleMonths.map(({ year, index }) => (
                    <td key={`${year}-${index}`} className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {colTotal(year, index).toLocaleString('ru-RU')}
                    </td>
                  ))}
                  <td className="budget-cell budget-cell-actions" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDeleteIds.length > 0}
        onClose={() => setConfirmDeleteIds([])}
        onConfirm={confirmDelete}
        title="Удалить строку?"
        description="Удаление записей источника за отображаемые годы необратимо."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
      />
    </div>
  );
}