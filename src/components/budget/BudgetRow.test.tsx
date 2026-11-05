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
  it('renders item name and amount in inputs', () => {
    renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      group: 'monthly',
      type: 'item',
    });
    const nameInput = screen.getAllByRole('textbox')[0];
    expect(nameInput).toHaveValue('Ипотека');
    const amountInput = screen.getAllByRole('textbox')[1];
    expect(amountInput).toHaveValue('12500');
  });

  it('calls onRemove when delete button clicked', () => {
    const onRemove = vi.fn();
    const { container } = renderRow(
      {
        id: '1',
        name: 'Ипотека',
        amount: 12500,
        group: 'monthly',
        type: 'item',
      },
      vi.fn(),
      onRemove
    );
    fireEvent.click(container.querySelector('button')!);
    expect(onRemove).toHaveBeenCalledWith('1');
  });
});