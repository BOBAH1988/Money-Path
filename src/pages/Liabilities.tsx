import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';

interface LiabilityRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

const initialData: LiabilityRow[] = [
  { id: '1', name: 'Ипотека', amount: 1_131_000, monthly: 11_000 },
  { id: '2', name: 'Деду', amount: 150_000, monthly: 0 },
  { id: '3', name: 'Кредитка', amount: 30_000, monthly: 0 },
];

export default function Liabilities() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Пассивы');
  }, [setPageTitle]);

  const [items, setItems] = useState<LiabilityRow[]>(initialData);

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
    if (!window.confirm('Удалить строку?')) return;
    if (items.length <= 1) {
      setItems(items.map((it) => (it.id === id ? { ...it, name: '', amount: 0, monthly: 0 } : it)));
    } else {
      setItems(items.filter((it) => it.id !== id));
    }
  };

  return (
    <div className="page page-budget">
      <BudgetTable
        id="liabilities-table"
        group="monthly"
        title="Пассивы"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Пассивы',
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
