import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { saveToFirestore, loadFromFirestore, COLLECTIONS } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

interface IncomeArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const emptyMonths = () => new Array(12).fill(0);

const migrateRow = (raw: any): IncomeArchiveRow => {
  const year = typeof raw?.year === 'number' ? raw.year : new Date().getFullYear();
  if (raw && Array.isArray(raw.months) && raw.months.length === 12) {
    return { id: raw.id, name: raw.name ?? '', year, months: raw.months.map((v: any) => (typeof v === 'number' ? v : 0)) };
  }
  const months = emptyMonths();
  if (typeof raw?.amount === 'number') months[0] = raw.amount;
  if (typeof raw?.monthly === 'number') months[1] = raw.monthly;
  return { id: raw?.id ?? crypto.randomUUID(), name: raw?.name ?? '', year, months };
};

const fmt = (v: number) => (v || 0).toLocaleString('ru-RU');

export default function IncomeArchive() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { user } = useAuth();
  const userId = user?.uid ?? undefined;

  useEffect(() => {
    setPageTitle('Доходы архив');
  }, [setPageTitle]);

  const [items, setItems] = useState<IncomeArchiveRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    const cur = now.getMonth();
    return (cur - 2 + 12) % 12;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addName, setAddName] = useState('');
  const [addMonths, setAddMonths] = useState<number[]>(emptyMonths());

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadFromFirestore<any>(COLLECTIONS.incomeArchive, userId);
        if (data.length > 0) {
          setItems(data.map(migrateRow));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    saveToFirestore(COLLECTIONS.incomeArchive, items as any, userId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    });
  }, [items, loaded, userId]);

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
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const months = [...it.months];
      months[monthIdx] = value;
      return { ...it, months };
    }));
  };

  const updateName = (id: string, name: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
  };

  const handleAdd = () => {
    const name = addName.trim();
    if (!name) return;
    const months = addMonths.map((v) => (typeof v === 'number' ? v : 0));
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name, year: selectedYear, months }]);
    setAddName('');
    setAddMonths(emptyMonths());
    setShowAddRow(false);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev.map((it) => (it.id === id ? { ...it, name: '', months: emptyMonths() } : it)) : prev.filter((it) => it.id !== id)));
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
              <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Ошибка загрузки данных</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Загрузка данных</div>
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
        <div className="budget-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="budget-card-title" style={{ margin: 0 }}>Доходы архив</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--bp-border, #e2e8f0)',
                background: 'var(--bp-card, #fff)',
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
          <div style={{ display: 'flex', gap: 8 }}>
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
                    <button className="btn-add btn-add-header" onClick={() => setShowAddRow((v) => !v)} aria-label="Добавить строку">+</button>
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
                            onBlur={finishEdit}
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
                            onBlur={finishEdit}
                            onKeyDown={(e) => e.key === 'Enter' && finishEdit()}
                          />
                        ) : (
                          <span className="row-amount">{fmt(row.months[idx])}</span>
                        )}
                      </td>
                    ))}
                      <td className="budget-cell budget-cell-actions">
                        <button className="btn-edit" onClick={() => setEditingId(row.id)} aria-label="Редактировать">✎</button>
                        {isEditing && (
                          <button className="btn-delete" onClick={() => handleRemove(row.id)} aria-label="Удалить">🗑️</button>
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
                      <button className="btn-delete" onClick={() => setShowAddRow(false)} aria-label="Отмена">×</button>
                    </td>
                  </tr>
                )}

                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name"><span className="footer-label">Итого:</span></td>
                  {visibleMonths.map((idx) => (
                    <td key={idx} className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {colTotal(idx).toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="budget-cell budget-cell-actions" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
