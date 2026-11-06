import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BudgetRow } from './BudgetRow';

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

  it('renders only edit button in actions cell by default', () => {
    const { container } = renderRow({
      id: '1',
      name: 'Ипотека',
      amount: 12500,
      plan: 12500,
      group: 'monthly',
      type: 'item',
    });
    expect(container.querySelector('.btn-edit')).toBeInTheDocument();
    expect(container.querySelector('.btn-delete')).toBeNull();
  });

  it('shows delete button in edit mode', () => {
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
    expect(container.querySelector('.btn-delete')).toBeInTheDocument();
    expect(container.querySelector('.btn-cancel')).toBeInTheDocument();
  });

  it('calls onRemove when confirm delete button clicked in edit mode', () => {
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
      onRemove,
      true
    );
    fireEvent.click(container.querySelector('.btn-delete')!);
    fireEvent.click(container.querySelector('.btn-delete-confirm')!);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('shows confirmation dialog after clicking delete in edit mode', () => {
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
    fireEvent.click(container.querySelector('.btn-delete')!);
    expect(container.querySelector('.confirm-overlay')).toBeInTheDocument();
    expect(container.textContent).toContain('Удалить строку "Ипотека"?');
  });

  it('calls onRemove when confirm delete button clicked', () => {
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
      onRemove,
      true
    );
    fireEvent.click(container.querySelector('.btn-delete')!);
    fireEvent.click(container.querySelector('.btn-delete-confirm')!);
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('does not call onRemove when cancel delete clicked', () => {
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
      onRemove,
      true
    );
    fireEvent.click(container.querySelector('.btn-delete')!);
    fireEvent.click(container.querySelector('.btn-cancel')!);
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
    fireEvent.click(container.querySelector('.btn-edit')!);
    expect(onStartEdit).toHaveBeenCalledWith('1');
  });

  it('shows cancel button only in edit mode', () => {
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
    expect(container.querySelector('.btn-cancel')).toBeInTheDocument();
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
