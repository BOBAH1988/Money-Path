import { useState, useCallback } from 'react';
import type { BudgetPlanItem, BudgetGroup } from '../../types';
import { BudgetRow } from './BudgetRow';
import type { BudgetPlanItem as RowItem } from '../../types';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { format } from './format';

interface Props {
  id?: string;
  group: BudgetGroup;
  title: string;
  items: BudgetPlanItem[];
  plannedItems?: BudgetPlanItem[];
  total: number;
  totalPlan?: number;
  onUpdate: (id: string, patch: { name?: string; amount?: number; plan?: number }) => void;
  onAdd: (group: BudgetGroup, name: string, amount: number, plan: number) => void;
  onRemove: (id: string) => void;
  onToggle?: (group: 'planned') => void;
  isPlannedCollapsed?: boolean;
  headers?: {
    name?: string;
    amount?: string;
    plan?: string;
  };
}

export const BudgetTable = ({
  id,
  group,
  title,
  items,
  plannedItems,
  total,
  totalPlan,
  onUpdate,
  onAdd,
  onRemove,
  onToggle,
  isPlannedCollapsed,
  headers,
}: Props) => {
  const groupItems = items.filter((it) => it.group === group);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletePickerOpen, setDeletePickerOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<RowItem | null>(null);

  // «+» сразу добавляет пустую строку в конец списка: отдельной формы ввода нет,
  // название и суммы правятся уже в самой строке тапом по ним.
  const handleAdd = () => {
    onAdd(group, '', 0, 0);
  };

  const finishEdit = () => {
    setEditingId(null);
  };

  const handleRemove = useCallback(
    (id: string) => {
      setEditingId(null);
      onRemove(id);
    },
    [onRemove]
  );

  const regularItems = groupItems.filter((it) => it.type === 'item');
  const subtotalItem = groupItems.find((it) => it.type === 'subtotal');
  const totalItem = groupItems.find((it) => it.type === 'total');

  const collapsed = isPlannedCollapsed ?? false;

  // Итог по запланированным расходам (группа 'planned') для строки «Дополнительные расходы»
  const plannedTotal = plannedItems
    ?.filter((it) => it.type === 'item')
    .reduce((sum, it) => sum + (it.amount ?? 0), 0) ?? 0;
  const plannedTotalPlan = plannedItems
    ?.filter((it) => it.type === 'item')
    .reduce((sum, it) => sum + (it.plan ?? 0), 0) ?? 0;
  const showPlannedInline = group === 'monthly' && plannedItems !== undefined;
  const displayTotal = showPlannedInline ? total + plannedTotal : total;
  const displayTotalPlan = showPlannedInline ? (totalPlan ?? 0) + plannedTotalPlan : (totalPlan ?? 0);

  return (
    <section className="budget-card" id={id}>
      <div className="budget-card-header">
        <h2 className="budget-card-title">{title}</h2>
        <div className="budget-card-actions">
          {editingId && (
            <button
              type="button"
              className="btn-done btn-done-header"
              onClick={finishEdit}
              aria-label="Завершить редактирование"
            >
              ✓
            </button>
          )}
          <button
            type="button"
            className="btn-remove btn-remove-header"
            onClick={() => setDeletePickerOpen(true)}
            disabled={items.filter((it) => it.group === group && it.type === 'item').length === 0}
            aria-label="Удалить строку"
            title="Удалить строку"
          >
            −
          </button>
          <button
            type="button"
            className="btn-add btn-add-header"
            onClick={() => {
              if (editingId) finishEdit();
              handleAdd();
            }}
            aria-label="Добавить строку"
            title="Добавить строку"
          >
            +
          </button>
        </div>
      </div>

      <div className="budget-card-body">
        <div className="budget-table-wrap">
          <table className="budget-table">
            <thead>
              <tr>
                <th className="budget-head budget-head-name">{headers?.name ?? 'Наименование'}</th>
                <th className="budget-head budget-head-amount">{headers?.amount ?? 'Сумма'}</th>
                <th className="budget-head budget-head-plan">{headers?.plan ?? 'План'}</th>
              </tr>
            </thead>
            <tbody>
              {regularItems.map((item) => (
                <BudgetRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={handleRemove}
                  onToggle={onToggle}
                  isPlannedCollapsed={collapsed}
                  isEditing={editingId === item.id}
                  onStartEdit={(editId) => setEditingId(editId)}
                  onFinishEdit={finishEdit}
                />
              ))}

              {subtotalItem && group === 'monthly' && plannedItems !== undefined && (
                <BudgetRow
                  key={subtotalItem.id}
                  item={subtotalItem}
                  onUpdate={onUpdate}
                  onRemove={handleRemove}
                  onToggle={onToggle}
                  isPlannedCollapsed={collapsed}
                  isEditing={editingId === subtotalItem.id}
                  onFinishEdit={finishEdit}
                />
              )}

              {group === 'monthly' && plannedItems !== undefined && !subtotalItem && (
                <tr className="budget-row subtotal">
                  <td className="budget-cell budget-cell-name">
                    <button
                      type="button"
                      className="row-name-btn"
                      onClick={() => onToggle?.('planned')}
                      aria-label={collapsed ? 'Развернуть дополнительные расходы' : 'Свернуть дополнительные расходы'}
                    >
                      {collapsed ? '▶' : '▼'} Дополнительные расходы
                    </button>
                    <span className="row-hint">сумма дополнительных расходов</span>
                  </td>
                  <td className="budget-cell budget-cell-amount">
                    <span className="row-amount">{format(plannedTotal)}</span>
                  </td>
                  <td className="budget-cell budget-cell-plan">
                    <span className="row-amount">{format(plannedTotalPlan)}</span>
                  </td>
                </tr>
              )}

              {totalItem ? (
                <BudgetRow
                  key={totalItem.id}
                  item={totalItem}
                  onUpdate={onUpdate}
                  onRemove={handleRemove}
                  isEditing={editingId === totalItem.id}
                  onFinishEdit={finishEdit}
                />
              ) : (
                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name">
                    <span className="footer-label">Итого:</span>
                  </td>
                  <td className="budget-cell budget-cell-amount">
                    {format(displayTotal)}
                  </td>
                  <td className="budget-cell budget-cell-plan">
                    {format(displayTotalPlan)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deletePickerOpen && (
        <div className="auth-overlay" onClick={() => setDeletePickerOpen(false)} role="dialog" aria-modal="true">
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="auth-close"
              onClick={() => setDeletePickerOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2 className="auth-title">Удалить строку</h2>
            <p className="import-hint">Выберите строку — удаление потребует подтверждения.</p>
            <div className="account-menu-actions">
              {groupItems
                .filter((it) => it.type === 'item')
                .map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="account-action-btn"
                    onClick={() => {
                      setDeletePickerOpen(false);
                      setPendingRemove(it);
                    }}
                  >
                    {it.name || '—'}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) handleRemove(pendingRemove.id);
          setPendingRemove(null);
        }}
        title="Удалить строку?"
        description={`Строка «${pendingRemove?.name ?? '—'}» будет удалена безвозвратно.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
      />
    </section>
  );
};