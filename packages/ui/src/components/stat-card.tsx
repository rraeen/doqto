import type { ReactNode } from 'react';
import { cn } from '../cn';

/** One number on a dashboard, with a label and an optional hint or change. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'good' | 'bad';
  className?: string;
}) {
  return (
    <div className={cn('rounded-sm border border-line bg-white p-4', className)}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-ink">{value}</p>
      {hint && (
        <p
          className={cn(
            'mt-1 text-xs',
            tone === 'good' && 'text-success',
            tone === 'bad' && 'text-danger',
            tone === 'neutral' && 'text-ink-muted',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
