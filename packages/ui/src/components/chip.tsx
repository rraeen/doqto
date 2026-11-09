'use client';

import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected: boolean;
  /** `radio` for single choice groups, `checkbox` for multi-select. */
  kind?: 'radio' | 'checkbox';
}

/** A large, tappable toggle used for choices such as specialties and languages. */
export function Chip({ selected, kind = 'checkbox', className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={selected}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-shadow disabled:opacity-50',
        selected
          ? 'neu-inset font-semibold text-brand-700'
          : 'neu-raised text-ink hover:brightness-105',
        className,
      )}
      {...props}
    >
      {selected && <Check className="size-4" aria-hidden />}
      {children}
    </button>
  );
}
