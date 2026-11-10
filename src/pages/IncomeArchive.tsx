import { useEffect, useState, useMemo, useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
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
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    const cur = now.getMonth();
    return (cur - 2 + 12) % 12;
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addName, setAddName] = useState('');
  const [addMonths, setAddMonths] = useState<number[]>(emptyMonths());

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    items.forEach((row) => {
      if (row.months.some((v) => v && v !== 0)) set.add(row.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [items, currentYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const yearItems = useMemo(() => items.filter((row) => row.year === selectedYear), [items, selectedYear]);
  const visibleMonths = useMemo(() => [monthStart, (monthStart + 1) % 12, (monthStart + 2) % 12], [monthStart]);

  const rowTotal = (row: IncomeArchiveRow) => row.months.reduce((s, v) => s + (v || 0), 0);
  const colTotal = (idx: number) => yearItems.reduce((s, row) => s + (row.months[idx] || 0), 0);
  const grandTotal = yearItems.reduce((s, row) => s + rowTotal(row), 0);

  const filledMonthsCount = useMemo(() => {
    const set = new Set<number>();
    yearItems.forEach((row) => row.months.forEach((v, idx) => { if (v && v !== 0) set.add(idx); }));
    return set.size;
  }, [yearItems]);
  const averageIncome = filledMonthsCount > 0 ? Math.round(grandTotal / filledMonthsCount) : 0;

  const updateCell = (id: string, monthIdx: number, value: number) => {
    const row = items.find((it) => it.id === id);
    if (!row) return;
    const nextMonths = [...row.months];
    nextMonths[monthIdx] = value;
    updateItem(id, { months: nextMonths });
  };

  const updateName = (id: string, name: string) => {
    updateItem(id, { name });
  };

  const handleAdd = () => {
    const name = addName.trim();
    if (!name) { setShowAddRow(false); setAddName(''); setAddMonths(emptyMonths()); return; }
    const months = addMonths.map((v) => (typeof v === 'number' ? v : 0));
    addItem({ name, year: selectedYear, months });
    setAddName('');
    setAddMonths(emptyMonths());
    setShowAddRow(false);
  };

  const handleRemove = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    removeItem(confirmDeleteId);
    setConfirmDeleteId(null);
    toastSuccess('Удалено', 'Строка удалена');
  };

  const prevWindow = () => setMonthStart((s) => (s - 2 + 12) % 12);
  const nextWindow = () => setMonthStart((s) => (s + 2) % 12);

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
              onChange={(e) => setSelectedYear(Number(e.target.value))}
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
                  {visibleMonths.map((idx) => (
                    <th key={idx} className="budget-head budget-head-amount">{MONTHS[idx]}</th>
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
                {items.filter((r) => r.year === selectedYear).map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr key={row.id} className="budget-row">
                      <td className="budget-cell budget-cell-name">
                        {isEditing ? (
                          <input
                            className="budget-input"
                            value={row.name}
                            onChange={(e) => updateName(row.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
                            autoFocus
                          />
                        ) : (
                          <span className="row-name">{row.name || '—'}</span>
                        )}
                      </td>
                    {visibleMonths.map((idx) => (
                      <td key={idx} className="budget-cell budget-cell-amount">
                        {isEditing ? (
                          <input
                            className="budget-input budget-input-amount"
                            value={row.months[idx] || ''}
                            onChange={(e) => updateCell(row.id, idx, Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
                            onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
                          />
                        ) : (
                          <span className="row-amount">{fmt(row.months[idx])}</span>
                        )}
                      </td>
                    ))}
                      <td className="budget-cell budget-cell-actions">
                        {!isEditing && (
                          <button className="btn-edit" onClick={() => setEditingId(row.id)} aria-label="Редактировать">✎</button>
                        )}
                        {isEditing && (
                          <button className="btn-delete" onClick={() => { handleRemove(row.id); setEditingId(null); }} aria-label="Удалить">🗑️</button>
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
                    {visibleMonths.map((idx) => (
                      <td key={idx} className="budget-cell budget-cell-amount">
                        <input
                          className="budget-input budget-input-amount"
                          value={addMonths[idx] || ''}
                          onChange={(e) => {
                            const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0;
                            setAddMonths((prev) => {
                              const next = [...prev];
                              next[idx] = v;
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
                  {visibleMonths.map((idx) => (
                    <td key={idx} className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {colTotal(idx).toLocaleString('ru-RU')}
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
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Удалить строку?"
        description="Удаление необратимо. Данные будут безвозвратно потеряны."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
      />
    </div>
  );
}