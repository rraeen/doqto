import type { ReactNode } from 'react';
import { cn } from '../cn';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const tones: Record<StatusTone, { chip: string; dot: string }> = {
  neutral: { chip: 'bg-surface text-ink-muted', dot: 'bg-ink-muted' },
  info: { chip: 'bg-info-bg text-info', dot: 'bg-info' },
  success: { chip: 'bg-success-bg text-success', dot: 'bg-success' },
  warning: { chip: 'bg-warning-bg text-warning', dot: 'bg-warning' },
  danger: { chip: 'bg-danger-bg text-danger', dot: 'bg-danger' },
};

/**
 * Status label with a coloured dot. The same status always gets the same tone in every app
 * (waiting is warning, confirmed is info, completed is success, no-show and cancelled are danger).
 */
export function StatusChip({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        t.chip,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', t.dot)} />
      {children}
    </span>
  );
}
