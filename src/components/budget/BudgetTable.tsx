import { useState } from 'react';
import type { BudgetPlanItem, BudgetGroup } from '../../types';
import { BudgetRow } from './BudgetRow';

interface Props {
  group: BudgetGroup;
  title: string;
  items: BudgetPlanItem[];
  total: number;
  onUpdate: (id: string, patch: { name?: string; amount?: number }) => void;
  onAdd: (group: BudgetGroup, name: string, amount: number) => void;
  onRemove: (id: string) => void;
}

export const BudgetTable = ({
  group,
  title,
  items,
  total,
  onUpdate,
  onAdd,
  onRemove,
}: Props) => {
  const groupItems = items.filter((it) => it.group === group);
  const [showAddRow, setShowAddRow] = useState(false);
  const [nameForAdd, setNameForAdd] = useState('');
  const [amountForAdd, setAmountForAdd] = useState('');

  const handleAdd = () => {
    const amountNum = Number(
      amountForAdd
        .replace(/[^\d.,-]/g, '')
        .replace(',', '.')
    ) || 0;
    if (!nameForAdd.trim()) return;
    onAdd(group, nameForAdd.trim(), amountNum);
    setNameForAdd('');
    setAmountForAdd('');
    setShowAddRow(false);
  };

  return (
    <section className="budget-card">
      <div className="budget-card-header">
        <h2 className="budget-card-title">{title}</h2>
        <div className="budget-card-actions">
          {!showAddRow ? (
            <button
              className="btn-add"
              onClick={() => setShowAddRow(true)}
              aria-label="Добавить строку"
            >
              +
            </button>
          ) : (
            <div className="add-row">
              <input
                className="budget-input budget-input-sm"
                value={nameForAdd}
                onChange={(e) => setNameForAdd(e.target.value)}
                placeholder="Новая строка"
                autoFocus
              />
              <div className="input-group input-group-sm">
                <input
                  className="budget-input budget-input-amount budget-input-sm"
                  value={amountForAdd}
                  onChange={(e) => setAmountForAdd(e.target.value)}
                  placeholder="0"
                />
                <span className="input-suffix">₽</span>
              </div>
              <button
                className="btn-add"
                onClick={handleAdd}
                aria-label="Добавить строку"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="budget-table-wrap">
        <table className="budget-table">
          <thead>
            <tr>
              <th className="budget-head budget-head-name">Наименование</th>
              <th className="budget-head budget-head-amount">Сумма</th>
              <th className="budget-head budget-head-actions" />
            </tr>
          </thead>
          <tbody>
            {groupItems.map((item) => (
              <BudgetRow
                key={item.id}
                item={item}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="budget-card-footer">
        <span className="footer-label">Итого:</span>
        <span className="footer-total">{total.toLocaleString('ru-RU')} ₽</span>
      </div>
    </section>
  );
};