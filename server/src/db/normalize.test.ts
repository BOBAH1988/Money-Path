import { describe, expect, it } from 'vitest';
import { toArchiveRow, toItemRow } from './normalize.js';

describe('toItemRow', () => {
  it('переносит строку активов/пассивов/доходов как есть', () => {
    expect(toItemRow({ id: 'a1', name: 'Квартира', amount: 100, monthly: 10 })).toEqual({
      id: 'a1',
      name: 'Квартира',
      amount: 100,
      monthly: 10,
    });
  });

  it('пропускает запись без id', () => {
    expect(toItemRow({ name: 'Без id', amount: 1 })).toBeNull();
    expect(toItemRow({ id: '', amount: 1 })).toBeNull();
  });

  it('нечисловые суммы превращает в 0', () => {
    expect(toItemRow({ id: 'a1', name: 42, amount: '100', monthly: Number.NaN })).toEqual({
      id: 'a1',
      name: '',
      amount: 0,
      monthly: 0,
    });
  });
});

describe('toArchiveRow', () => {
  const now = new Date('2026-11-19T00:00:00.000Z');

  it('сохраняет 12 месяцев', () => {
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(toArchiveRow({ id: 'r1', name: 'Зарплата', year: 2025, months }, now)).toEqual({
      id: 'r1',
      name: 'Зарплата',
      year: 2025,
      months,
    });
  });

  it('разбирает legacy-запись с amount/monthly', () => {
    const row = toArchiveRow({ id: 'r2', name: 'Старая', amount: 500, monthly: 50 }, now);

    expect(row?.months).toHaveLength(12);
    expect(row?.months[0]).toBe(500);
    expect(row?.months[1]).toBe(50);
    expect(row?.months[2]).toBe(0);
  });

  it('подставляет текущий год, если его нет', () => {
    expect(toArchiveRow({ id: 'r3' }, now)?.year).toBe(2026);
  });

  it('считает массив не на 12 месяцев повреждённым и переносит в legacy-путь', () => {
    const row = toArchiveRow({ id: 'r4', months: [1, 2, 3], amount: 7 }, now);

    expect(row?.months).toHaveLength(12);
    expect(row?.months[0]).toBe(7);
  });
});
