import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm text-ink', className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}
