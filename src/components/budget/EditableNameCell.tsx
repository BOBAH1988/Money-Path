import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onCommit: (next: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Название строки: тап превращает текст в поле ввода прямо в ячейке.
 * Enter сохраняет, Escape отменяет, уход фокуса сохраняет.
 */
export const EditableNameCell = ({ value, onCommit, label, placeholder }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(value ?? '');
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    const next = draft.trim();
    setEditing(false);
    onCommit(next);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-name-input"
        type="text"
        value={draft}
        placeholder={placeholder ?? 'Название'}
        aria-label={label ?? 'Название строки'}
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
    <button
      type="button"
      className="row-name-btn"
      onClick={start}
      aria-label={label ? `Изменить: ${value || '—'}` : 'Изменить название'}
    >
      {value || '—'}
    </button>
  );
};
