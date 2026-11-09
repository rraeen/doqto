import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-surface text-ink-muted shadow-xs',
        brand: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-500/30',
        success: 'bg-success-bg text-success ring-1 ring-inset ring-success/20',
        warning: 'bg-warning-bg text-warning ring-1 ring-inset ring-warning/20',
        danger: 'bg-danger-bg text-danger ring-1 ring-inset ring-danger/20',
        info: 'bg-info-bg text-info ring-1 ring-inset ring-info/20',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
