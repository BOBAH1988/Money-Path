import { type ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<string, string> = {
  primary: 'btn-ui btn-ui-primary',
  secondary: 'btn-ui btn-ui-secondary',
  danger: 'btn-ui btn-ui-danger',
  ghost: 'btn-ui btn-ui-ghost',
};

const sizeClasses: Record<string, string> = {
  sm: 'btn-ui-sm',
  md: 'btn-ui-md',
  lg: 'btn-ui-lg',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...rest
}: Props) => {
  const base = variantClasses[variant] ?? variantClasses.primary;
  const sizeClass = sizeClasses[size] ?? sizeClasses.md;

  return (
    <button
      className={[base, sizeClass, fullWidth ? 'btn-ui-full' : '', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="loading-spinner" aria-hidden="true">⟳</span>}
      {children}
    </button>
  );
};
