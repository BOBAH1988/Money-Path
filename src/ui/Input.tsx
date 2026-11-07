import { type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'error'> {
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export const Input = ({ label, error, prefix, suffix, className = '', inputProps, ...rest }: Props) => {
  return (
    <div className={`input-field ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <div className="input-wrapper">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input className="input-element" {...rest} {...inputProps} />
        {suffix && <span className="input-affix">{suffix}</span>}
      </div>
      {error && <span className="input-error">{error}</span>}
    </div>
  );
};
