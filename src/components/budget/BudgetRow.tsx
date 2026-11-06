import { useState } from 'react';
import type { BudgetPlanItem } from '../../types';

interface Props {
  item: BudgetPlanItem;
  onUpdate: (id: string, patch: { name?: string; amount?: number; plan?: number }) => void;
  onRemove: (id: string) => void;
  onToggle?: (group: 'planned') => void;
  isPlannedCollapsed?: boolean;
}

export const BudgetRow = ({ item, onUpdate, onRemove, onToggle, isPlannedCollapsed }: Props) => {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const startEdit = () => {
    if (isTotal || isSubtotal) return;
    setEditing(true);
    setName(item.name);
    setAmount(String(item.amount));
    setPlan(String(item.plan));
  };

  const handleDelete = () => {
    if (!window.confirm(`Удалить строку "${item.name}"?`)) return;
    onRemove(item.id);
    setEditing(false);
  };

  const togglePlanned = () => {
    if (!isSubtotal || !onToggle) return;
    onToggle('planned');
  };
  const format = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (confirmDelete) {
    return (
      <div className="confirm-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-card">
          <p>Удалить строку "{item.name}"?</p>
          <div className="confirm-actions">
            <button className="btn-cancel" onClick={() => setConfirmDelete(false)}>Отмена</button>
            <button className="btn-delete-confirm" onClick={() => { onRemove(item.id); setEditing(false); setConfirmDelete(false); }}>Удалить</button>
          </div>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <tr className={`budget-row ${item.type}`} onClick={isSubtotal ? togglePlanned : undefined}>
        <td className="budget-cell budget-cell-name">
          <span className="row-name">{item.name}</span>
          {isSubtotal && <span className="row-hint">сумма запланированных расходов</span>}
        </td>
        <td className="budget-cell budget-cell-amount">
          <span className="row-amount">{format(item.amount)}</span>
          <span className="row-currency">₽</span>
        </td>
        <td className="budget-cell budget-cell-plan">
          <span className="row-amount">{format(item.plan)}</span>
          <span className="row-currency">₽</span>
        </td>
        <td className="budget-cell budget-cell-actions">
        {isSubtotal && (
          <button
            className="btn-edit"
            onClick={(e) => { e.stopPropagation(); togglePlanned(); }}
            aria-label={isPlannedCollapsed ? "Развернуть запланированные расходы" : "Свернуть запланированные расходы"}
          >
            {isPlannedCollapsed ? "▶" : "▼"}
          </button>
        )}
          {!isSubtotal && !isTotal && (
            <button
              className="btn-edit"
              onClick={startEdit}
              aria-label="Редактировать строку"
            >
              ✎
            </button>
          )}
        </td>
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
            onClick={handleDelete}
            aria-label="Удалить строку"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
};
