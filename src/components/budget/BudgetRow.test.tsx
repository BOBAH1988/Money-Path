import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BudgetRow } from './BudgetRow';

const renderRow = (item: any, onUpdate = vi.fn(), onRemove = vi.fn()) =>
  render(
    <table>
      <tbody>
        <BudgetRow item={item} onUpdate={onUpdate} onRemove={onRemove} />
      </tbody>
    </table>
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
    expect(container.querySelector('.row-name')?.textContent).toBe('Ипотека');
    const amounts = container.querySelectorAll('.row-amount');
    expect(amounts[0]?.textContent).toBe('12 500');
    expect(amounts[1]?.textContent).toBe('12 500');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('shows inputs after clicking the row', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    fireEvent.click(container.querySelector('.row-name')!);
    const nameInput = screen.getAllByRole('textbox')[0];
    expect(nameInput).toHaveValue('Ипотека');
    const amountInput = screen.getAllByRole('textbox')[1];
    expect(amountInput).toHaveValue('12500');
    const planInput = screen.getAllByRole('textbox')[2];
    expect(planInput).toHaveValue('12500');
  });

  it('calls onRemove when delete button clicked in edit mode', () => {
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
    fireEvent.click(container.querySelector('.row-name')!);
    const deleteBtn = container.querySelector('.btn-delete')!;
    fireEvent.click(deleteBtn);
    expect(onRemove).toHaveBeenCalledWith('1');
  });
});
