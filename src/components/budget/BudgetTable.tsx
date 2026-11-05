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
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const groupItems = items.filter((it) => it.group === group);

  const handleAdd = () => {
    const amountNum = Number(newAmount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    if (!newName.trim()) return;
    onAdd(group, newName.trim(), amountNum);
    setNewName('');
    setNewAmount('');
  };

  return (
    <section className="budget-card">
      <div className="budget-card-header">
        <h2 className="budget-card-title">{title}</h2>
        <div className="budget-card-actions">
          <div className="add-row">
            <input
              className="budget-input budget-input-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Новая строка"
            />
            <div className="input-group input-group-sm">
              <input
                className="budget-input budget-input-amount budget-input-sm"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
              />
              <span className="input-suffix">₽</span>
            </div>
            <button className="btn-add" onClick={handleAdd} aria-label="Добавить строку">
              +
            </button>
          </div>
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