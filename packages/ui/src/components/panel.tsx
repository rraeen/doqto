import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Flat bordered surface for lists, tables and forms in the console. The soft
 * raised `Card` stays for sign-in screens and highlight tiles; dense screens use this.
 */
export function Panel({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cn('rounded-sm border border-line bg-white', className)} {...props}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
