import { useState, useEffect, useRef } from 'react';
import type { BudgetPlanItem } from '../../types';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useToast } from '../../ui/Toast';
import { EditableAmountCell } from './EditableAmountCell';

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
  const wasEditing = useRef(isEditing);
  const itemIdRef = useRef(item.id);

  const isSubtotal = item.type === 'subtotal';
  const isTotal = item.type === 'total';

  // Reset local edit state whenever the underlying item changes (e.g. cloud update),
  // so stale local values never overwrite fresh server data.
  useEffect(() => {
    if (itemIdRef.current !== item.id) {
      itemIdRef.current = item.id;
      setName(item.name);
      setAmount(String(item.amount ?? 0));
      setPlan(String(item.plan ?? 0));
    }
  }, [item.id, item.name, item.amount, item.plan]);

  // Save when exiting edit mode via external trigger (Готово кнопка)
  useEffect(() => {
    if (isEditing) {
      wasEditing.current = true;
      return;
    }
    if (!wasEditing.current) return;

    wasEditing.current = false;
    const hasChanges = name !== item.name || amount !== String(item.amount ?? 0) || plan !== String(item.plan ?? 0);
    if (!hasChanges) return;

    onUpdate(item.id, {
      name: name.trim() || item.name,
      amount: Number(amount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
      plan: Number(plan.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
    });
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
    // Always sync local fields from the current item so cloud updates
    // are not overwritten by stale local values when editing begins.
    setName(item.name);
    setAmount(String(item.amount ?? 0));
    setPlan(String(item.plan ?? 0));
    if (onStartEdit) {
      onStartEdit(item.id);
    }
  };

  // Долгое нажатие на название — единственный путь к удалению строки:
  // случайный тап по кнопке больше не может стереть данные.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    if (plain) return;
    longPressFired.current = false;
    cancelLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setConfirmDelete(true);
    }, 600);
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
        description={`Строка «${item.name}» будет удалена безвозвратно.`}
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
          <input
            className="budget-input budget-input-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            aria-label="Сумма"
          />
        </td>
        <td className="budget-cell budget-cell-plan">
          <input
            className="budget-input budget-input-amount"
            type="text"
            inputMode="decimal"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            aria-label="План"
          />
        </td>
      </tr>
    );
  }

  const plain = isSubtotal || isTotal;

  return (
    <>
      <tr className={`budget-row ${item.type}${plain ? '' : ' budget-row-tappable'}`}>
        <td className="budget-cell budget-cell-name">
          {plain ? (
            <span className="row-name">{item.name}</span>
          ) : (
            <button
              type="button"
              className="row-name-btn"
              onClick={startEdit}
              onContextMenu={(e) => { e.preventDefault(); setConfirmDelete(true); }}
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              aria-label={`Изменить название: ${item.name}. Долгое нажатие — удалить строку`}
              title="Долгое нажатие — удалить"
            >
              {item.name}
            </button>
          )}
          {isSubtotal && <span className="row-hint">сумма дополнительных расходов</span>}
        </td>
        <td className="budget-cell budget-cell-amount">
          <EditableAmountCell
            value={item.amount ?? 0}
            label={item.name}
            readOnly={plain}
            onCommit={(next) => onUpdate(item.id, { amount: next })}
          />
          {isTotal && <span className="row-currency">₽</span>}
        </td>
        <td className="budget-cell budget-cell-plan">
          <EditableAmountCell
            value={item.plan ?? 0}
            label={`${item.name} — план`}
            readOnly={plain}
            onCommit={(next) => onUpdate(item.id, { plan: next })}
          />
          {isTotal && <span className="row-currency">₽</span>}
        </td>
      </tr>
      {isSubtotal && (
        <tr className="budget-row-subaction">
          <td colSpan={3}>
            <button
              type="button"
              className="row-toggle-btn"
              onClick={togglePlanned}
            >
              {isPlannedCollapsed ? '▶ Показать дополнительные расходы' : '▼ Свернуть дополнительные расходы'}
            </button>
          </td>
        </tr>
      )}
    </>
  );
};
