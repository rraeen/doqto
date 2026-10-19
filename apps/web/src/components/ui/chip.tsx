'use client';

import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

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
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
        selected
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-line bg-surface text-ink hover:bg-canvas',
        className,
      )}
      {...props}
    >
      {selected && <Check className="size-4" aria-hidden />}
      {children}
    </button>
  );
}
