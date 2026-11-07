import { type ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

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
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-65 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-[#007aff] text-white hover:bg-[#005bb5] active:scale-95',
    secondary: 'bg-[#f3f4f6] text-[#111827] border border-[#e5e7eb] hover:bg-[#e5e7eb] active:scale-95',
    danger: 'bg-[#dc2626] text-white hover:bg-[#b91c1c] active:scale-95',
    ghost: 'text-[#6b7280] hover:bg-[#f3f4f6] active:scale-95',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={[base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="loading-spinner" aria-hidden="true">⟳</span>}
      {children}
    </button>
  );
};
