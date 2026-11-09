import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'flex min-h-tap cursor-pointer items-start gap-3 py-1 text-sm text-ink',
        className,
      )}
    >
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}
