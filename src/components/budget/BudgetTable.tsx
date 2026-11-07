import { useState } from 'react';
import type { BudgetPlanItem, BudgetGroup } from '../../types';
import { BudgetRow } from './BudgetRow';
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
  const [showAddRow, setShowAddRow] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [inputPlan, setInputPlan] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const amountNum = Number(
      inputAmount.replace(/[^\d.,-]/g, '').replace(',', '.')
    ) || 0;
    const planNum = Number(
      inputPlan.replace(/[^\d.,-]/g, '').replace(',', '.')
    ) || 0;
    const trimmed = inputName.trim();
    if (!trimmed) return;
    onAdd(group, trimmed, amountNum, planNum);
    setInputName('');
    setInputAmount('');
    setInputPlan('');
    setShowAddRow(false);
  };

  const finishEdit = () => {
    setEditingId(null);
  };

  const regularItems = groupItems.filter((it) => it.type === 'item');
  const subtotalItem = groupItems.find((it) => it.type === 'subtotal');
  const totalItem = groupItems.find((it) => it.type === 'total');

  const collapsed = isPlannedCollapsed ?? false;

  return (
    <section className="budget-card" id={id}>
      <div className="budget-card-header">
        <h2 className="budget-card-title">{title}</h2>
      </div>

      <div className="budget-card-body">
        <div className="budget-table-wrap">
          <table className="budget-table">
            <thead>
              <tr>
                <th className="budget-head budget-head-name">{headers?.name ?? 'Наименование'}</th>
                <th className="budget-head budget-head-amount">{headers?.amount ?? 'Сумма'}</th>
                <th className="budget-head budget-head-plan">{headers?.plan ?? 'План'}</th>
<th className="budget-head budget-head-actions">
                  {editingId || showAddRow ? (
                    <button
                      className="btn-done btn-done-header"
                      onClick={() => { if (editingId) finishEdit(); if (showAddRow) setShowAddRow(false); }}
                      aria-label="ОК"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      className="btn-add btn-add-header"
                      onClick={() => setShowAddRow(true)}
                      aria-label="Добавить строку"
                    >
                      +
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {regularItems.map((item) => (
                <BudgetRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onToggle={onToggle}
                  isPlannedCollapsed={collapsed}
                  isEditing={editingId === item.id}
                  onStartEdit={(editId) => setEditingId(editId)}
                  onFinishEdit={finishEdit}
                />
              ))}

              {showAddRow && (
                <tr className="budget-row budget-row-editing">
                  <td className="budget-cell budget-cell-name">
                    <input
                      className="budget-input"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      placeholder="Новая строка"
                      autoFocus
                    />
                  </td>
                  <td className="budget-cell budget-cell-amount">
                    <div className="input-group">
                      <input
                        className="budget-input budget-input-amount"
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="budget-cell budget-cell-plan">
                    <div className="input-group">
                      <input
                        className="budget-input budget-input-amount"
                        value={inputPlan}
                        onChange={(e) => setInputPlan(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="0"
                      />
                    </div>
                  </td>
                  <td className="budget-cell budget-cell-actions">
                    <button
                      className="btn-delete"
                      onClick={() => setShowAddRow(false)}
                      aria-label="Отмена"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )}

              {subtotalItem && group === 'monthly' && plannedItems !== undefined && (
                <BudgetRow
                  key={subtotalItem.id}
                  item={subtotalItem}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onToggle={onToggle}
                  isPlannedCollapsed={collapsed}
                  isEditing={editingId === subtotalItem.id}
                  onFinishEdit={finishEdit}
                />
              )}

              {group === 'monthly' && plannedItems !== undefined && !subtotalItem && (
                <tr
                  className="budget-row subtotal"
                  onClick={() => onToggle && onToggle('planned')}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="budget-cell budget-cell-name">
                    <span className="row-name">Дополнительные расходы</span>
                    <span className="row-hint">сумма дополнительных расходов</span>
                  </td>
                  <td className="budget-cell budget-cell-amount">
                    <span className="row-amount">{format(0)}</span>
                    <span className="row-currency">₽</span>
                  </td>
                  <td className="budget-cell budget-cell-plan">
                    <span className="row-amount">{format(totalPlan ?? 0)}</span>
                    <span className="row-currency">₽</span>
                  </td>
                  <td className="budget-cell budget-cell-actions">
                    <button
                      className="btn-edit"
                      onClick={(e) => { e.stopPropagation(); onToggle?.('planned'); }}
                      aria-label={collapsed ? "Развернуть дополнительные расходы" : "Свернуть дополнительные расходы"}
                    >
                      {collapsed ? "▶" : "▼"}
                    </button>
                  </td>
                </tr>
              )}

              {totalItem ? (
                <BudgetRow
                  key={totalItem.id}
                  item={totalItem}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  isEditing={editingId === totalItem.id}
                  onFinishEdit={finishEdit}
                />
              ) : (
                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name">
                    <span className="footer-label">Итого:</span>
                  </td>
                  <td className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap' }}>
                    {format(total)}<span className="row-currency">₽</span>
                  </td>
                  <td className="budget-cell budget-cell-plan" style={{ whiteSpace: 'nowrap' }}>
                    <>
                      {format(totalPlan ?? 0)}
                      <span className="row-currency">₽</span>
                    </>
                  </td>
                  <td className="budget-cell budget-cell-actions" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};