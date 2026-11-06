import { useEffect, useState } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';

interface LiabilityRow {
  id: string;
  name: string;
  amount: number;
  monthly: number;
}

const format = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const initialData: LiabilityRow[] = [
  { id: '1', name: 'Накопления', amount: 500_000, monthly: 0 },
  { id: '2', name: 'Инвестиции', amount: 200_000, monthly: 5_000 },
  { id: '3', name: 'Деньги', amount: 80_000, monthly: 0 },
];

export default function Assets() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Активы');
  }, [setPageTitle]);

  const [items, setItems] = useState<LiabilityRow[]>(initialData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);

  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [inputMonthly, setInputMonthly] = useState('');

  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMonthly, setEditMonthly] = useState('');

  const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);
  const totalMonthly = items.reduce((sum, it) => sum + it.monthly, 0);

  const handleAdd = () => {
    const amountNum = Number(inputAmount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const monthlyNum = Number(inputMonthly.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const trimmed = inputName.trim();
    if (!trimmed) return;
    setItems([...items, { id: crypto.randomUUID(), name: trimmed, amount: amountNum, monthly: monthlyNum }]);
    setInputName('');
    setInputAmount('');
    setInputMonthly('');
    setShowAddRow(false);
  };

  const handleSave = (id: string) => {
    const amountNum = Number(editAmount.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const monthlyNum = Number(editMonthly.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    setItems(items.map((it) => (it.id === id ? { ...it, name: editName.trim() || it.name, amount: amountNum, monthly: monthlyNum } : it)));
    setEditingId(null);
  };

  const handleRemove = (id: string) => {
    if (!window.confirm('Удалить строку?')) return;
    if (items.length <= 1) {
      setItems(items.map((it) => (it.id === id ? { ...it, name: '', amount: 0, monthly: 0 } : it)));
    } else {
      setItems(items.filter((it) => it.id !== id));
    }
  };

  return (
    <div className="page page-budget">
      <section className="budget-card">
        <div className="budget-card-header">
          <h2 className="budget-card-title">Активы</h2>
          <div className="budget-card-actions">
            <button
              className="btn-add btn-add-header"
              onClick={() => setShowAddRow(true)}
              aria-label="Добавить строку"
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
                  <th className="budget-head budget-head-name">Активы</th>
                  <th className="budget-head budget-head-amount">Сумма</th>
                  <th className="budget-head budget-head-plan">% в мес.</th>
                  <th className="budget-head budget-head-actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`budget-row ${editingId === item.id ? 'budget-row-editing' : ''}`}>
                    {editingId === item.id ? (
                      <>
                        <td className="budget-cell budget-cell-name">
                          <input
                            className="budget-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleSave(item.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave(item.id)}
                            placeholder="Название"
                            autoFocus
                          />
                        </td>
                        <td className="budget-cell budget-cell-amount">
                          <div className="input-group">
                            <input
                              className="budget-input budget-input-amount"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              onBlur={() => handleSave(item.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave(item.id)}
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="budget-cell budget-cell-plan">
                          <div className="input-group">
                            <input
                              className="budget-input budget-input-amount"
                              value={editMonthly}
                              onChange={(e) => setEditMonthly(e.target.value)}
                              onBlur={() => handleSave(item.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave(item.id)}
                              placeholder="0"
                            />
                          </div>
                        </td>
                        <td className="budget-cell budget-cell-actions">
                          <button className="btn-delete" onClick={() => setEditingId(null)} aria-label="Отмена">
                            ×
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="budget-cell budget-cell-name">
                          <span className="row-name">{item.name}</span>
                        </td>
                        <td className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap' }}>
                          <span className="row-amount">{format(item.amount)}</span>
                          <span className="row-currency">₽</span>
                        </td>
                        <td className="budget-cell budget-cell-plan" style={{ whiteSpace: 'nowrap' }}>
                          <span className="row-amount">{format(item.monthly)}</span>
                          <span className="row-currency">₽</span>
                        </td>
                        <td className="budget-cell budget-cell-actions">
                          <button
                            className="btn-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(item.name);
                              setEditAmount(String(item.amount));
                              setEditMonthly(String(item.monthly));
                              setEditingId(item.id);
                            }}
                            aria-label="Редактировать строку"
                          >
                            ✎
                          </button>
                          <button
                            className="btn-delete"
                            onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                            aria-label="Удалить строку"
                          >
                            ×
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
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
                          value={inputMonthly}
                          onChange={(e) => setInputMonthly(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="budget-cell budget-cell-actions">
                      <button className="btn-delete" onClick={() => setShowAddRow(false)} aria-label="Отмена">
                        ×
                      </button>
                    </td>
                  </tr>
                )}

                <tr className="budget-row total">
                  <td className="budget-cell budget-cell-name">
                    <span className="footer-label">Итого:</span>
                  </td>
                  <td className="budget-cell budget-cell-amount" style={{ whiteSpace: 'nowrap' }}>
                    <span className="row-amount">{format(totalAmount)}</span>
                    <span className="row-currency">₽</span>
                  </td>
                  <td className="budget-cell budget-cell-plan" style={{ whiteSpace: 'nowrap' }}>
                    <span className="row-amount">{format(totalMonthly)}</span>
                    <span className="row-currency">₽</span>
                  </td>
                  <td className="budget-cell budget-cell-actions" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
