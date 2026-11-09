import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const widths = {
  /** Forms and single-purpose screens on a phone-width column. */
  narrow: 'max-w-xl',
  /** Settings and editors. */
  medium: 'max-w-3xl',
  /** Lists, dashboards and profiles that use the full desktop width. */
  wide: 'max-w-[1100px]',
} as const;

/** Standard page column: padded, centred, clears the bottom nav on phones. */
export function Page({
  children,
  className,
  withNav = true,
  size = 'narrow',
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
  size?: keyof typeof widths;
}) {
  return (
    <main
      className={cn(
        'mx-auto w-full px-4 pt-6 sm:px-6 md:pt-8',
        widths[size],
        withNav ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-12' : 'pb-10',
        className,
      )}
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
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{children}</h1>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
