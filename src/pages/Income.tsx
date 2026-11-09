import { useContext, useEffect, useMemo, useState } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { useAuth } from '../context/AuthContext';
import { COLLECTIONS } from '../lib/dataStore';
import { loadFromFirestore } from '../lib/firestore';
import { useData } from '../hooks/useData';
import { Button, ConfirmDialog, EmptyState, Input } from '../ui';

interface Row {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

interface IncomeArchiveRow {
  id: string;
  name: string;
  year: number;
  months: number[];
}

const CURRENT_YEAR = new Date().getFullYear();

export default function Income() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid, isAuthReady } = useAuth();
  const userId = uid;
  const { items, addItem, updateItem, removeItem } = useData<Row>({
    collectionName: COLLECTIONS.income,
    userId,
  });

  const [averageIncome, setAverageIncome] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', amount: 0, monthly: 0 });
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setPageTitle('Доходы');
  }, [setPageTitle]);

  useEffect(() => {
    if (!isAuthReady || !userId) {
      setAverageIncome(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId);
        if (cancelled) return;
        const yearRows = rows.filter((r) => r.year === CURRENT_YEAR);
        if (yearRows.length === 0) { setAverageIncome(0); return; }
        const totalByMonth = new Array(12).fill(0);
        yearRows.forEach((r) => r.months.forEach((v, idx) => { if (v && v !== 0) totalByMonth[idx] += v; }));
        const filled = totalByMonth.filter((v) => v && v !== 0);
        setAverageIncome(filled.length ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length) : 0);
      } catch {
        if (!cancelled) setAverageIncome(0);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, isAuthReady]);

  const totalMonthly = useMemo(() => items.reduce((sum, it) => sum + (it.monthly || 0), 0), [items]);

  const addRow = () => addItem({ name: '', amount: 0, monthly: 0 });
  const startEdit = (r: Row) => { setEditId(r.id); setDraft({ name: r.name, amount: r.amount, monthly: r.monthly }); };
  const cancelEdit = () => setEditId(null);
  const saveEdit = (id: string) => { updateItem(id, draft); setEditId(null); };

  return (
    <div className="page page-budget">
      <div className="budget-page-header">
        <h1 className="budget-page-header h1">Доходы</h1>
        <p className="budget-page-subtitle">Текущие источники дохода и ориентир по среднему доходу</p>
        <div className="budget-page-actions">
          <Button variant="secondary" onClick={addRow}>+ Добавить</Button>
        </div>
      </div>

      <div className="budget-card">
        <div className="budget-card-header"><h2 className="budget-card-title">Источники дохода</h2></div>
        <div className="budget-card-body">
          {items.length === 0 ? (
            <EmptyState icon="💵" title="Пока нет доходов" description="Добавьте источник дохода, чтобы учитывать поступления." action={<Button variant="secondary" onClick={addRow}>Добавить доход</Button>} />
          ) : (
            <div className="budget-table-wrap">
              <table className="budget-table">
                <thead><tr><th style={{ width: 44 }}>№</th><th>Название</th><th style={{ width: 140 }}>Сумма</th><th style={{ width: 140 }}>В месяц</th><th style={{ width: 120 }}></th></tr></thead>
                <tbody>
                  {items.map((r, idx) => {
                    const isEdit = editId === r.id;
                    return (
                      <tr key={r.id} className="budget-row">
                        <td className="row-id">{idx + 1}</td>
                        <td className="row-name">{isEdit ? <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /> : r.name || '—'}</td>
                        <td className="row-amount">{isEdit ? <Input type="number" value={draft.amount || ''} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })} /> : `${(r.amount ?? 0).toLocaleString('ru-RU')} ₽`}</td>
                        <td className="row-plan">{isEdit ? <Input type="number" value={draft.monthly || ''} onChange={(e) => setDraft({ ...draft, monthly: Number(e.target.value) || 0 })} /> : `${(r.monthly ?? 0).toLocaleString('ru-RU')} ₽`}</td>
                        <td className="row-actions">
                          {isEdit ? (<><Button size="sm" onClick={() => saveEdit(r.id)}>Сохранить</Button><Button size="sm" variant="secondary" onClick={cancelEdit}>Отмена</Button></>) : (<><Button size="sm" variant="secondary" onClick={() => startEdit(r)}>Изменить</Button><Button size="sm" variant="danger" onClick={() => setConfirm({ id: r.id, name: r.name || 'доход' })}>Удалить</Button></>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="budget-summary">
            <div className="summary-item summary-item-total"><span className="summary-label">Средний доход (архив {CURRENT_YEAR})</span><span className="summary-value">{averageIncome.toLocaleString('ru-RU')} ₽</span></div>
            <div className="summary-item"><span className="summary-label">Планируемый доход</span><span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span></div>
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm) removeItem(confirm.id); setConfirm(null); }} title="Удалить доход?" description={confirm ? `«${confirm.name}» будет удалён.` : undefined} confirmLabel="Удалить" />
    </div>
  );
}
