import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="size-7" aria-hidden />
        </div>
      )}
      <p className="text-lg font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
