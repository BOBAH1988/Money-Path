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
  const [amount, setAmount] = useState(String(item.amount));
  const [plan, setPlan] = useState(String(item.plan));

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

  if (!editing && (isSubtotal || isTotal)) {
    return (
      <tr className={`budget-row ${item.type}`}>
        <td className="budget-cell budget-cell-name">
          <span className="row-name">{item.name}</span>
          {isSubtotal && <span className="row-hint">из запланированных расходов</span>}
        </td>
        <td className="budget-cell budget-cell-amount">
          <span className="row-amount">{amountFormatter(item.amount)}</span>
          <span className="row-currency">₽</span>
        </td>
        <td className="budget-cell budget-cell-plan" />
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
          <span className="input-suffix">₽</span>
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
          <span className="input-suffix">₽</span>
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

const amountFormatter = (value: number) => {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
