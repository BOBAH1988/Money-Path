import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { saveToFirestore, loadFromFirestore, COLLECTIONS } from '../lib/firestore';

interface AssetRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

const initialData: AssetRow[] = [
  { id: '1', name: 'Накопления', amount: 500_000, monthly: 0 },
  { id: '2', name: 'Инвестиции', amount: 200_000, monthly: 5_000 },
  { id: '3', name: 'Деньги', amount: 80_000, monthly: 0 },
];

export default function Assets() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Активы');
  }, [setPageTitle]);

  const [items, setItems] = useState<AssetRow[]>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadFromFirestore<AssetRow>(COLLECTIONS.assets);
        if (data.length > 0) {
          setItems(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveToFirestore(COLLECTIONS.assets, items).catch((err) => {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    });
  }, [items, loaded]);

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
          <span className="summary-label">Итого</span>
          <span className="summary-value">{totalAmount.toLocaleString('ru-RU')} ₽</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">% в месяц</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

      <BudgetTable
        id="assets-table"
        group="monthly"
        title="Активы"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Активы',
          amount: 'Сумма',
          plan: '% в мес.',
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
