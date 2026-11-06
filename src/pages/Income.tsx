import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';

interface IncomeRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

const INCOME_STORAGE_KEY = 'denegnyj_put_income';

const initialData: IncomeRow[] = [
  { id: '1', name: 'Зарплата', amount: 150_000, monthly: 150_000 },
  { id: '2', name: 'Дивиденды', amount: 30_000, monthly: 0 },
  { id: '3', name: 'Аренда', amount: 20_000, monthly: 20_000 },
];

const loadIncome = (): IncomeRow[] => {
  try {
    const raw = localStorage.getItem(INCOME_STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw) as IncomeRow[];
    if (!parsed || !Array.isArray(parsed)) return initialData;
    return parsed;
  } catch {
    return initialData;
  }
};

export default function Income() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Доход');
  }, [setPageTitle]);

  const [items, setItems] = useState<IncomeRow[]>(loadIncome);

  useEffect(() => {
    try {
      localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

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
        id="income-table"
        group="monthly"
        title="Доход"
        items={budgetItems}
        total={totalAmount}
        totalPlan={totalMonthly}
        headers={{
          name: 'Доход',
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
