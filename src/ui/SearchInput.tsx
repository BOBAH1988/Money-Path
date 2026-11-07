import { Input } from './Input';
import { type ChangeEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export const SearchInput = ({ value, onChange, placeholder = 'Поиск...', label }: Props) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="search-field">
      {label && <label className="search-label">{label}</label>}
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        prefix="🔍"
        inputProps={{
          className: 'search-input',
          'aria-label': label || 'Поиск',
        }}
      />
    </div>
  );
};
