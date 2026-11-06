import { useState } from 'react';
import type { BudgetPlanItem } from '../../types';

interface Props {
  item: BudgetPlanItem;
  onUpdate: (id: string, patch: { name?: string; amount?: number; plan?: number }) => void;
  onRemove: (id: string) => void;
}

export const BudgetRow = ({ item, onUpdate, onRemove }: Props) => {
  const [editing, setEditing] = useState(item.type === 'item');
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount ?? 0));
  const [plan, setPlan] = useState(String(item.plan ?? 0));

  const isSubtotal = item.type === 'subtotal';
  const isTotal = item.type === 'total';

  const handleSave = () => {
    const amountNum = Number(amount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const planNum = Number(plan.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    onUpdate(item.id, {
      name: name.trim() || item.name,
      amount: amountNum,
      plan: planNum,
    });
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setName(item.name);
      setAmount(String(item.amount));
      setPlan(String(item.plan));
      setEditing(false);
    }
  };

  const toggleEdit = () => {
    if (isTotal) return;
    setEditing(true);
    setName(item.name);
    setAmount(String(item.amount));
    setPlan(String(item.plan));
  };

  const format = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (!editing && (isSubtotal || isTotal || !isSubtotal && !isTotal)) {
    return (
      <tr className={`budget-row ${item.type}`} onClick={toggleEdit}>
        <td className="budget-cell budget-cell-name">
          <span className="row-name">{item.name}</span>
          {isSubtotal && <span className="row-hint">из запланированных расходов</span>}
        </td>
        <td className="budget-cell budget-cell-amount">
          <span className="row-amount">{format(item.amount)}</span>
        </td>
        <td className="budget-cell budget-cell-plan">
          <span className="row-amount">{format(item.plan)}</span>
        </td>
        <td className="budget-cell budget-cell-actions" />
      </tr>
    );
  }

  return (
    <tr className="budget-row budget-row-editing">
      <td className="budget-cell budget-cell-name">
        <input
          className="budget-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder="Название"
        />
      </td>
      <td className="budget-cell budget-cell-amount">
        <div className="input-group">
          <input
            className="budget-input budget-input-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="0"
          />
        </div>
      </td>
      <td className="budget-cell budget-cell-plan">
        <div className="input-group">
          <input
            className="budget-input budget-input-amount"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="0"
          />
        </div>
      </td>
      <td className="budget-cell budget-cell-actions">
        {!isTotal && (
          <button
            className="btn-delete"
            onClick={() => onRemove(item.id)}
            aria-label="Удалить строку"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
};
