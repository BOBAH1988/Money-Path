import { useState, useEffect } from 'react';
import type { BudgetPlanItem } from '../../types';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useToast } from '../../ui/Toast';
import { format } from './format';

interface Props {
  item: BudgetPlanItem;
  onUpdate: (id: string, patch: { name?: string; amount?: number; plan?: number }) => void;
  onRemove: (id: string) => void;
  onToggle?: (group: 'planned') => void;
  isPlannedCollapsed?: boolean;
  isEditing?: boolean;
  onStartEdit?: (id: string) => void;
  onFinishEdit?: () => void;
}

export const BudgetRow = ({ item, onUpdate, onRemove, onToggle, isPlannedCollapsed, isEditing = false, onStartEdit, onFinishEdit }: Props) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(String(item.amount ?? 0));
  const [plan, setPlan] = useState(String(item.plan ?? 0));
  const { success: toastSuccess } = useToast();

  const isSubtotal = item.type === 'subtotal';
  const isTotal = item.type === 'total';

  // Save when exiting edit mode via external trigger (Готово button)
  useEffect(() => {
    if (!isEditing) {
      const wasEditing = name !== item.name || amount !== String(item.amount ?? 0) || plan !== String(item.plan ?? 0);
      if (wasEditing) {
        onUpdate(item.id, {
          name: name.trim() || item.name,
          amount: Number(amount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
          plan: Number(plan.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
        });
      }
    }
  }, [isEditing, name, amount, plan, item, onUpdate]);

  const handleSave = () => {
    onUpdate(item.id, {
      name: name.trim() || item.name,
      amount: Number(amount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
      plan: Number(plan.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
    });
    if (onFinishEdit) {
      onFinishEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setName(item.name);
      setAmount(String(item.amount));
      setPlan(String(item.plan));
      if (onFinishEdit) {
        onFinishEdit();
      }
    }
  };

  const startEdit = () => {
    if (isTotal || isSubtotal) return;
    if (onStartEdit) {
      onStartEdit(item.id);
    } else {
      setName(item.name);
      setAmount(String(item.amount));
      setPlan(String(item.plan));
    }
  };

  const togglePlanned = () => {
    if (!isSubtotal || !onToggle) return;
    onToggle('planned');
  };

  if (confirmDelete) {
    return (
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { onRemove(item.id); setConfirmDelete(false); toastSuccess('Удалено', 'Строка удалена'); }}
        title="Удалить строку?"
        description={`Удаление "${item.name}" необратимо`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
      />
    );
  }

  if (isEditing) {
    return (
      <tr className="budget-row budget-row-editing">
        <td className="budget-cell budget-cell-name">
          <input
            className="budget-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Название"
            autoFocus
          />
        </td>
        <td className="budget-cell budget-cell-amount">
          <div className="input-group">
            <input
              className="budget-input budget-input-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
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
              placeholder="0"
            />
          </div>
        </td>
        <td className="budget-cell budget-cell-actions">
          <button className="btn-delete" onClick={() => setConfirmDelete(true)} aria-label="Удалить строку">
            🗑️
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`budget-row ${item.type}`} onClick={isSubtotal ? togglePlanned : undefined}>
      <td className="budget-cell budget-cell-name">
        <span className="row-name">{item.name}</span>
        {isSubtotal && <span className="row-hint">сумма дополнительных расходов</span>}
      </td>
        <td className="budget-cell budget-cell-amount">
        <span className="row-amount">{format(item.amount ?? 0)}</span>
        <span className="row-currency">₽</span>
      </td>
      <td className="budget-cell budget-cell-plan">
        <span className="row-amount">{format(item.plan ?? 0)}</span>
        <span className="row-currency">₽</span>
      </td>
      <td className="budget-cell budget-cell-actions">
      {isSubtotal && (
        <button
          className="btn-edit"
          onClick={(e) => { e.stopPropagation(); togglePlanned(); }}
          aria-label={isPlannedCollapsed ? "Развернуть дополнительные расходы" : "Свернуть дополнительные расходы"}
        >
          {isPlannedCollapsed ? "▶" : "▼"}
        </button>
      )}
        {!isSubtotal && !isTotal && (
          <button
            className="btn-edit"
            onClick={(e) => { e.stopPropagation(); startEdit(); }}
            aria-label="Редактировать строку"
          >
            ✎
          </button>
        )}
      </td>
    </tr>
  );
};
