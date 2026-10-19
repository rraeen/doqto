'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-line',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block size-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-7' : 'translate-x-1',
        )}
      />
    </button>
  );
}
