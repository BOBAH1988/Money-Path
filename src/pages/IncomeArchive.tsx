import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { saveToFirestore, loadFromFirestore, COLLECTIONS } from '../lib/firestore';

interface IncomeArchiveRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

const initialData: IncomeArchiveRow[] = [
  { id: '1', name: 'Премия 2025', amount: 50_000, monthly: 0 },
  { id: '2', name: 'Возврат налога', amount: 13_000, monthly: 0 },
  { id: '3', name: 'Продажа авто', amount: 200_000, monthly: 0 },
];

export default function IncomeArchive() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Доходы архив');
  }, [setPageTitle]);

  const [items, setItems] = useState<IncomeArchiveRow[]>(initialData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await loadFromFirestore<IncomeArchiveRow>(COLLECTIONS.incomeArchive);
      if (data.length > 0) {
        setItems(data);
      }
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveToFirestore(COLLECTIONS.incomeArchive, items);
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
        id="income-archive-table"
        group="monthly"
        title="Доходы архив"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Источник',
          amount: 'Сумма',
          plan: 'Повтор',
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
