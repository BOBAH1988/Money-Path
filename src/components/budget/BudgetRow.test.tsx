import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { BudgetRow } from './BudgetRow';
import { ToastProvider } from '../../ui/Toast';

afterEach(() => cleanup());
afterEach(() => {
  vi.restoreAllMocks();
});

const renderRow = (
  item: any,
  onUpdate = vi.fn(),
  onRemove = vi.fn(),
  isEditing = false,
  onStartEdit = vi.fn()
) =>
  render(
    <ToastProvider>
      <table>
        <tbody>
          <BudgetRow
            item={item}
            onUpdate={onUpdate}
            onRemove={onRemove}
            isEditing={isEditing}
            onStartEdit={onStartEdit}
            onFinishEdit={vi.fn()}
          />
        </tbody>
      </table>
    </ToastProvider>
  );

describe('BudgetRow', () => {
  it('renders item name and amount as text (not inputs) by default', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    expect(container.querySelector('.row-name-btn')?.textContent).toBe('Ипотека');
    const amounts = container.querySelectorAll('.cell-amount-value');
    // Intl вставляет неразрывный пробел — сравниваем нормализованный текст.
    expect(amounts[0]?.textContent?.replace(/\u00a0/g, ' ')).toBe('12 500');
    expect(amounts[1]?.textContent?.replace(/\u00a0/g, ' ')).toBe('12 500');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('column «Действия» больше не используется: правка по тапу на название', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    expect(container.querySelector('.budget-cell-actions')).toBeNull();
    expect(container.querySelector('.row-name-btn')).toBeInTheDocument();
  });

  it('в режиме правки нет кнопки удаления', () => {
    const { container } = renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        plan: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      vi.fn(),
      true
    );
    expect(container.querySelector('.btn-delete')).toBeNull();
    expect(container.querySelector('.budget-cell-actions')).toBeNull();
  });

  it('долгое нажатие на название открывает подтверждение удаления', async () => {
    const onRemove = vi.fn();
    const { container } = renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        plan: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      onRemove
    );
    const nameBtn = container.querySelector('.row-name-btn')!;
    fireEvent.pointerDown(nameBtn);
    await new Promise((resolve) => setTimeout(resolve, 700));
    fireEvent.pointerUp(nameBtn);

    expect(document.querySelector('.confirm-title')?.textContent).toContain('Удалить строку');
    fireEvent.click(screen.getByRole('button', { name: /Удалить/ }));
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('отмена в подтверждении не удаляет строку', async () => {
    const onRemove = vi.fn();
    const { container } = renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        plan: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      onRemove
    );
    const nameBtn = container.querySelector('.row-name-btn')!;
    fireEvent.pointerDown(nameBtn);
    await new Promise((resolve) => setTimeout(resolve, 700));
    fireEvent.click(screen.getByRole('button', { name: /Отмена/ }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows inputs when in edit mode', () => {
    renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        plan: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      vi.fn(),
      true
    );
    const nameInput = screen.getAllByRole('textbox')[0];
    expect(nameInput).toHaveValue('Ипотека');
    const amountInput = screen.getAllByRole('textbox')[1];
    expect(amountInput).toHaveValue('12500');
    const planInput = screen.getAllByRole('textbox')[2];
    expect(planInput).toHaveValue('12500');
  });

  it('saves normalized input only once when exiting edit mode', () => {
    const onUpdate = vi.fn();
    const Harness = () => {
      const [item, setItem] = useState({
        id: '1',
        name: 'Ипотека',
        amount: 0,
        plan: 0,
        group: 'monthly' as const,
        type: 'item' as const,
      });
      const [isEditing, setIsEditing] = useState(true);

      return (
        <>
          <button onClick={() => setIsEditing(false)}>Done</button>
        <table>
          <tbody>
            <BudgetRow
              item={item}
              onUpdate={(id, patch) => {
                onUpdate(id, patch);
                setItem((current) => ({ ...current, ...patch }));
              }}
              onRemove={vi.fn()}
              isEditing={isEditing}
              onStartEdit={vi.fn()}
              onFinishEdit={() => setIsEditing(false)}
            />
          </tbody>
        </table>
        </>
      );
    };

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '1 000' } });
    fireEvent.click(screen.getByText('Done'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('1', { name: 'Ипотека', amount: 1000, plan: 0 });
  });

  it('calls onStartEdit when clicking edit button', () => {
    const onStartEdit = vi.fn();
    const { container } = renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        plan: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      vi.fn(),
      false,
      onStartEdit
    );
    fireEvent.click(container.querySelector('.row-name-btn')!);
    expect(onStartEdit).toHaveBeenCalledWith('1');
  });

  it('тап по сумме открывает правку значения в ячейке', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    fireEvent.click(container.querySelector('.cell-amount-value')!);
    const input = container.querySelector('.cell-amount-input');
    expect(input).toHaveValue('12500');
  });

  it('does not enter edit mode when clicking the row', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    fireEvent.click(container.querySelector('tr')!);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
