import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('рендерит первичную кнопку с темозависимым классом', () => {
    render(<Button>Первичная</Button>);
    const btn = screen.getByRole('button', { name: 'Первичная' });
    expect(btn).toHaveClass('btn-ui');
    expect(btn).toHaveClass('btn-ui-primary');
  });

  it('рендерит опасную кнопку', () => {
    render(<Button variant="danger">Удалить</Button>);
    expect(screen.getByRole('button', { name: 'Удалить' })).toHaveClass('btn-ui-danger');
  });

  it('рендерит призрачную кнопку', () => {
    render(<Button variant="ghost">Отмена</Button>);
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveClass('btn-ui-ghost');
  });

  it('блокирует кнопку в загрузке и показывает спиннер', () => {
    render(<Button loading>Сохранение</Button>);
    const btn = screen.getByRole('button', { name: /Сохранение/ });
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.loading-spinner')).toBeInTheDocument();
  });

  it('при нажатии вызывает onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Нажми</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Нажми' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
