import { useState } from 'react';
import type { BudgetPlanItem, BudgetGroup } from '../../types';
import { BudgetRow } from './BudgetRow';

interface Props {
  group: BudgetGroup;
  title: string;
  items: BudgetPlanItem[];
  total: number;
  onUpdate: (id: string, patch: { name?: string; amount?: number; plan?: number }) => void;
  onAdd: (group: BudgetGroup, name: string, amount: number, plan: number) => void;
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
  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [inputPlan, setInputPlan] = useState('');

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

  // Разделяем элементы на обычные, subtotal и total для правильного порядка
  const regularItems = groupItems.filter((it) => it.type === 'item');
  const subtotalItem = groupItems.find((it) => it.type === 'subtotal');
  const totalItem = groupItems.find((it) => it.type === 'total');

  return (
    <section className="budget-card">
      <div className="budget-card-header">
        <h2 className="budget-card-title">{title}</h2>
      </div>

      <div className="budget-card-body">
        <div className="budget-table-wrap">
          <table className="budget-table">
            <thead>
              <tr>
                <th className="budget-head budget-head-name">Наименование</th>
                <th className="budget-head budget-head-amount">Сумма (факт)</th>
                <th className="budget-head budget-head-plan">План</th>
                <th className="budget-head budget-head-actions">
                  <button
                    className="btn-add btn-add-header"
                    onClick={() => setShowAddRow(true)}
                    aria-label="Добавить строку"
                  >
                    +
                  </button>
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
                      <span className="input-suffix">₽</span>
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
                      <span className="input-suffix">₽</span>
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

              {subtotalItem && (
                <BudgetRow
                  key={subtotalItem.id}
                  item={subtotalItem}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              )}

              {totalItem ? (
                <BudgetRow
                  key={totalItem.id}
                  item={totalItem}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ) : (
                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name">
                    <span className="footer-label">Итого:</span>
                  </td>
                  <td className="budget-cell budget-cell-amount">
                    {total.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="budget-cell budget-cell-plan" />
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