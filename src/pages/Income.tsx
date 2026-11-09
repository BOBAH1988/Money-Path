import { useContext, useEffect, useMemo, useState } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { useAuth } from '../context/AuthContext';

const CURRENT_YEAR = new Date().getFullYear();

interface IncomeRow {
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

const migrateArchiveRow = (
  raw: { id?: string; name?: string; year?: number; months?: number[]; amount?: number; monthly?: number }
): IncomeArchiveRow => {
  const year = typeof raw?.year === 'number' ? raw.year : new Date().getFullYear();
  if (raw && Array.isArray(raw.months) && raw.months.length === 12) {
    return { id: raw.id ?? crypto.randomUUID(), name: raw.name ?? '', year, months: raw.months.map((v) => (typeof v === 'number' ? v : 0)) };
  }
  const months = new Array(12).fill(0);
  if (typeof raw?.amount === 'number') months[0] = raw.amount;
  if (typeof raw?.monthly === 'number') months[1] = raw.monthly;
  return { id: raw.id ?? crypto.randomUUID(), name: raw.name ?? '', year, months };
};

export default function Income() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { uid, isAuthReady } = useAuth();
  const userId = uid;

  useEffect(() => {
    setPageTitle('Доходы');
  }, [setPageTitle]);

  const { items, loading: itemsLoading, error: itemsError, addItem, updateItem, removeItem } =
    useCollection<IncomeRow>({
      collectionName: COLLECTIONS.income,
      userId,
    });

  const [archive, setArchive] = useState<IncomeArchiveRow[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  useEffect(() => {
    // Загрузка обрабатывается только после подтверждения авторизации, иначе запрос
    // уйдёт без ID-токена и будет отклонён правилами безопасности.
    if (!isAuthReady || !userId) {
      setArchive([]);
      setArchiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive, userId);
        if (!cancelled) {
          setArchive(data.map(migrateArchiveRow));
        }
      } catch {
        if (!cancelled) {
          setArchive([]);
        }
      } finally {
        if (!cancelled) setArchiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAuthReady]);

  const archiveRows = useMemo(() => archive.filter((r) => r.year === CURRENT_YEAR), [archive]);
  const archiveTotal = useMemo(
    () => archiveRows.reduce((s, row) => s + row.months.reduce((a, b) => a + (b || 0), 0), 0),
    [archiveRows]
  );
  const archiveFilledMonths = useMemo(() => {
    const set = new Set<number>();
    archiveRows.forEach((row) => row.months.forEach((v, idx) => { if (v && v !== 0) set.add(idx); }));
    return set.size;
  }, [archiveRows]);
  const archiveAverage = archiveFilledMonths > 0 ? Math.round(archiveTotal / archiveFilledMonths) : 0;

  const budgetItems = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: it.amount,
        plan: it.monthly,
        group: 'monthly' as BudgetGroup,
        type: 'item' as const,
      })),
    [items]
  );

  const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);
  const totalMonthly = items.reduce((sum, it) => sum + it.monthly, 0);

  const loading = itemsLoading || archiveLoading;
  const error = itemsError;

  if (error) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--dp-color-danger)' }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                  Ошибка загрузки данных
                </div>
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
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                Загрузка данных
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-budget">
      <div className="budget-summary">
        <div className="summary-item summary-item-total">
          <span className="summary-label">Средний доход</span>
          <span className="summary-value">{archiveAverage.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Планируемый доход</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <BudgetTable
        id="income-table"
        group="monthly"
        title="Доходы"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Доходы',
          amount: 'Сумма',
          plan: 'План',
        }}
        onUpdate={(id, patch) => {
          updateItem(id, {
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.amount !== undefined && { amount: patch.amount }),
            ...(patch.plan !== undefined && { monthly: patch.plan }),
          });
        }}
        onAdd={(_group, name, amount, plan) => {
          addItem({ name, amount, monthly: plan });
        }}
        onRemove={removeItem}
      />
    </div>
  );
}
