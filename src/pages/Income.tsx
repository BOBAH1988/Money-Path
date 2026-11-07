import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { saveToFirestore, loadFromFirestore, COLLECTIONS } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';

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

const migrateArchiveRow = (raw: any): IncomeArchiveRow => {
  const year = typeof raw?.year === 'number' ? raw.year : new Date().getFullYear();
  if (raw && Array.isArray(raw.months) && raw.months.length === 12) {
    return { id: raw.id, name: raw.name ?? '', year, months: raw.months.map((v: any) => (typeof v === 'number' ? v : 0)) };
  }
  const months = new Array(12).fill(0);
  if (typeof raw?.amount === 'number') months[0] = raw.amount;
  if (typeof raw?.monthly === 'number') months[1] = raw.monthly;
  return { id: raw?.id ?? crypto.randomUUID(), name: raw?.name ?? '', year, months };
};

export default function Income() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { user } = useAuth();
  const userId = user?.uid ?? undefined;

  useEffect(() => {
    setPageTitle('Доходы');
  }, [setPageTitle]);

  const [items, setItems] = useState<IncomeRow[]>([]);
  const [incomeArchive, setIncomeArchive] = useState<IncomeArchiveRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, archive] = await Promise.all([
          loadFromFirestore<IncomeRow>(COLLECTIONS.income, userId),
          loadFromFirestore<any>(COLLECTIONS.incomeArchive, userId),
        ]);
        if (data.length > 0) {
          setItems(data);
        }
        setIncomeArchive(archive.map(migrateArchiveRow));
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
    saveToFirestore(COLLECTIONS.income, items, userId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    });
  }, [items, loaded, userId]);

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

  const currentYear = new Date().getFullYear();
  const archiveRows = incomeArchive.filter((r) => r.year === currentYear);
  const archiveTotal = archiveRows.reduce((s, row) => s + row.months.reduce((a, b) => a + (b || 0), 0), 0);
  const archiveFilledMonths = useMemo(() => {
    const set = new Set<number>();
    archiveRows.forEach((row) => row.months.forEach((v, idx) => { if (v && v !== 0) set.add(idx); }));
    return set.size;
  }, [archiveRows]);
  const archiveAverage = archiveFilledMonths > 0 ? Math.round(archiveTotal / archiveFilledMonths) : totalAmount;

  const handleRemove = (id: string) => {
    if (items.length <= 1) {
      setItems(items.map((it) => (it.id === id ? { ...it, name: '', amount: 0, monthly: 0 } : it)));
    } else {
      setItems(items.filter((it) => it.id !== id));
    }
  };

  if (error) {
    return (
      <div className="page page-budget">
        <div className="budget-card">
          <div className="budget-card-body">
            <div className="budget-table-wrap">
              <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
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
        title="Доход"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Доходы',
          amount: 'Сумма',
          plan: 'План',
        }}
        onUpdate={(id, patch) => {
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== id) return it;
              return {
                ...it,
                ...(patch.name !== undefined && { name: patch.name }),
                ...(patch.amount !== undefined && { amount: patch.amount }),
                ...(patch.plan !== undefined && { monthly: patch.plan }),
              };
            })
          );
        }}
        onAdd={(_group, name, amount, plan) => {
          setItems([...items, { id: crypto.randomUUID(), name, amount, monthly: plan }]);
        }}
        onRemove={handleRemove}
      />
    </div>
  );
}
