import { useEffect, useState, useMemo } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/PageTitleContext';
import { BudgetTable } from '../components/budget/BudgetTable';
import type { BudgetGroup } from '../types';
import { saveToFirestore, loadFromFirestore, COLLECTIONS } from '../lib/firestore';
import { useAuth } from '../context/AuthContext';
import { safeNegate } from '../lib/budget';
import { useToast } from '../ui/Toast';

interface LiabilityRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

export default function Liabilities() {
  const { setPageTitle } = useContext(PageTitleContext)!;
  const { toast: addToast } = useToast();
  const { user } = useAuth();
  const userId = user?.uid ?? undefined;

  useEffect(() => {
    setPageTitle('Пассивы');
  }, [setPageTitle]);

  const [items, setItems] = useState<LiabilityRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadFromFirestore<LiabilityRow>(COLLECTIONS.liabilities, userId);
        if (data.length > 0) {
          setItems(data);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки данных';
        setError(msg);
        addToast('error', 'Ошибка загрузки', msg);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, [userId, addToast]);

  useEffect(() => {
    if (!loaded) return;
    saveToFirestore(COLLECTIONS.liabilities, items, userId).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения';
      setError(msg);
      addToast('error', 'Ошибка сохранения', msg);
    });
  }, [items, loaded, userId, addToast]);

  const budgetItems = useMemo(
    () =>
      items.map((it) => ({
        id: it.id,
        name: it.name,
        amount: -it.amount,
        plan: -it.monthly,
        group: 'monthly' as BudgetGroup,
        type: 'item' as const,
      })),
    [items]
  );

  const totalAmount = safeNegate(items.reduce((sum, it) => sum + it.amount, 0));
  const totalMonthly = safeNegate(items.reduce((sum, it) => sum + it.monthly, 0));

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
          <span className="summary-label">Оплата % в месяц</span>
          <span className="summary-value">{totalMonthly.toLocaleString('ru-RU')} ₽</span>
        </div>
      </div>

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
