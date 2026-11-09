'use client';

import { Star } from 'lucide-react';
import { useId } from 'react';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/** Five tappable stars (1 to 5) as a radio group, 44px each so a thumb can hit them. */
export function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-semibold text-ink">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={t('reviews.starsLabel', { n })}
              onClick={() => onChange(n)}
              className="flex size-11 items-center justify-center rounded-full transition-transform active:scale-90"
            >
              <Star
                className={cn('size-7', on ? 'text-warning' : 'text-line')}
                fill={on ? 'currentColor' : 'none'}
                strokeWidth={1.8}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only stars, for showing a rating that was already given. */
export function StarsStatic({ value, className }: { value: number; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      role="img"
      aria-label={t('reviews.starsLabel', { n: value })}
      className={cn('inline-flex gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('size-4', n <= value ? 'text-warning' : 'text-line')}
          fill={n <= value ? 'currentColor' : 'none'}
          strokeWidth={1.8}
          aria-hidden
        />
      ))}
    </span>
  );
}
