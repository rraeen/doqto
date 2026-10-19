import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Standard page column: phone-width, padded, clears the bottom nav. */
export function Page({
  children,
  className,
  withNav = true,
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
}) {
  return (
    <main
      className={cn('mx-auto w-full max-w-xl px-4 pt-5', withNav ? 'pb-24' : 'pb-10', className)}
    >
      {children}
    </main>
  );
}

export function PageTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-ink">{children}</h1>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
