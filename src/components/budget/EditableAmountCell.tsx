import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Текущее числовое значение ячейки. */
  value: number;
  /** Сохранение: значение уже приведено к числу. */
  onCommit: (next: number) => void;
  /** Необязательное название строки для подписи в диалоге. */
  label?: string;
  /** Отключить взаимодействие (итоговые и служебные строки). */
  readOnly?: boolean;
  /** Формат отображения; по умолчанию — с разделителем тысяч. */
  formatValue?: (value: number) => string;
}

const toNumber = (raw: string): number => {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Ячейка с числом: тап открывает правку прямо на месте. Поле ввода
 * занимает всю ячейку, поэтому на телефоне строка не вылезает за экран
 * и не наплывает на соседние.
 */
export const EditableAmountCell = ({
  value,
  onCommit,
  label,
  readOnly = false,
  formatValue,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const format = formatValue ?? ((v: number) => (v || 0).toLocaleString('ru-RU'));

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    if (readOnly) return;
    setDraft(String(value ?? 0));
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    const next = toNumber(draft);
    setEditing(false);
    if (next !== value) onCommit(next);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-amount-input"
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={label ? `Значение: ${label}` : 'Значение'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <span className="cell-amount">
      <button
        type="button"
        className="cell-amount-value"
        onClick={start}
        disabled={readOnly}
        aria-label={label ? `Изменить значение: ${label}` : 'Изменить значение'}
      >
        {format(value)}
      </button>
    </span>
  );
};
