import { useEffect, useState, useMemo, useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { COLLECTIONS } from '../lib/dataStore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../hooks/useData';
import { getIncomeArchiveMonthWindow } from '../lib/incomeArchive';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import { IncomeArchiveChart } from '../components/IncomeArchiveChart';
import { EditableAmountCell } from '../components/budget/EditableAmountCell';
import { EditableNameCell } from '../components/budget/EditableNameCell';

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
  const [deletePickerOpen, setDeletePickerOpen] = useState(false);

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

  const confirmDelete = () => {
    if (!confirmDeleteIds.length) return;
    confirmDeleteIds.forEach(removeItem);
    setConfirmDeleteIds([]);
    toastSuccess('Удалено', 'Источник удалён');
  };

  const changeWindow = (start: number) => {
    setMonthStart(start);
  };

  const prevWindow = () => changeWindow(monthStart - 1);
  const nextWindow = () => changeWindow(monthStart + 1);

  // «+» сразу создаёт источник в таблице: название по умолчанию, нули по месяцам.
  // Модалку открываем тапом по названию уже созданной строки.
  const handleAdd = () => {
    addItem({ name: 'Новый источник', year: selectedYear, months: new Array(12).fill(0) });
    toastSuccess('Источник добавлен', 'Название и суммы можно изменить тапом по строке');
  };

  // Название правится в самой ячейке: окно больше не открывается.
  const handleNameChange = (row: IncomeArchiveRow, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === row.name) return;
    updateItem(row.id, { name: trimmed });
  };

  // Правка одного месяца прямо в ячейке: остальные значения строки не трогаем.
  const handleMonthChange = (row: IncomeArchiveRow, year: number, monthIndex: number, next: number) => {
    const target = items.find((r) => r.id === row.id && r.year === year);
    if (!target) return;
    const months = target.months.slice();
    while (months.length <= monthIndex) months.push(0);
    months[monthIndex] = next;
    updateItem(target.id, { months });
  };

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
      {error && (
        <div className="budget-card" role="status">
          <div className="budget-card-body" style={{ color: 'var(--dp-color-danger)' }}>
            Не удалось обновить данные из облака. Показаны сохранённые на устройстве данные. {error}
          </div>
        </div>
      )}
      <section className="dashboard-kpi-grid income-summary-grid" aria-label="Итоги доходов">
        <article className="dashboard-kpi dashboard-kpi-success">
          <span className="dashboard-kpi-label">Итого за год {selectedYear}</span>
          <strong className="dashboard-kpi-value">{grandTotal.toLocaleString('ru-RU')} ₽</strong>
        </article>
        <article className="dashboard-kpi">
          <span className="dashboard-kpi-label">Средний доход</span>
          <strong className="dashboard-kpi-value">{averageIncome.toLocaleString('ru-RU')} ₽</strong>
        </article>
      </section>

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
            <button
              className="btn-remove btn-remove-header"
              onClick={() => setDeletePickerOpen(true)}
              disabled={visibleRows.length === 0}
              aria-label="Удалить источник"
              title="Удалить источник"
            >
              −
            </button>
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
                  {visibleMonths.map(({ year, index }) => (
                    <th key={`${year}-${index}`} className="budget-head budget-head-amount income-month-head">
                      <span className="income-month-name">{MONTHS[index]}</span>
                      <span className="archive-month-year">{year}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  return (
                    <tr key={row.id} className="budget-row budget-row-tappable">
                      <td className="budget-cell budget-cell-name">
                        <EditableNameCell
                          value={row.name}
                          label="Название источника"
                          onCommit={(next) => handleNameChange(row, next)}
                        />
                      </td>
                      {visibleMonths.map(({ year, index }) => {
                        const matchingRow = visibleRows.find((r) => r.id === row.id && r.year === year);
                        return (
                          <td key={`${year}-${index}`} className="budget-cell budget-cell-amount">
                            <EditableAmountCell
                              value={matchingRow?.months[index] ?? 0}
                              label={`${row.name || 'источник'} — ${MONTHS[index]}`}
                              onCommit={(next) => handleMonthChange(row, year, index, next)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {hasData && (
                  <tr className="budget-row total">
                    <td className="budget-cell budget-cell-name"><span className="footer-label">Итого:</span></td>
                    {visibleMonths.map(({ year, index }) => (
                      <td key={`${year}-${index}`} className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {colTotal(year, index).toLocaleString('ru-RU')}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <IncomeArchiveChart rows={items} />

      {deletePickerOpen && (
        <div className="auth-overlay" onClick={() => setDeletePickerOpen(false)} role="dialog" aria-modal="true">
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="auth-close"
              onClick={() => setDeletePickerOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2 className="auth-title">Удалить источник</h2>
            <p className="import-hint">Выберите источник — удаление потребует подтверждения.</p>
            <div className="account-menu-actions">
              {visibleRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="account-action-btn"
                  onClick={() => {
                    setDeletePickerOpen(false);
                    setConfirmDeleteIds([row.id]);
                  }}
                >
                  {row.name || '—'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
