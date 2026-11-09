'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Logo } from './logo';
import { useScrolled } from './use-scrolled';

/**
 * Floating pill header shared by the patient, clinic, admin and sign-in shells. At the top of a
 * page it is transparent, so the page shows through; once you scroll it takes the page's surface
 * colour and raised look so content passing underneath stays readable. `center` holds the desktop
 * links; on phones the bottom nav takes over (the header shows the logo and account actions).
 */
export function AppHeader({
  href = '/',
  badge,
  center,
  right,
  className,
}: {
  href?: string;
  badge?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  /** Extra classes for the outer header. */
  className?: string;
}) {
  const scrolled = useScrolled();
  const pathname = usePathname();
  // Chat uses its own header on phones; hide this bar there even when `showOnMobile`.
  if (/^\/consult\/[^/]+/.test(pathname)) className = cn('max-md:hidden', className);
  return (
    <header
      className={cn(
        // On phones the bar is a full-width strip from the top edge, with no gap around it.
        'sticky top-0 z-40 w-full bg-transparent max-md:px-0 max-md:pt-0 md:px-6 md:pt-[max(1rem,env(safe-area-inset-top))]',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-[1100px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full px-3 py-2 max-md:rounded-none max-md:px-4 max-md:pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6 transition-[background-color,box-shadow] duration-300',
          scrolled
            ? 'neu-raised max-md:border-0 max-md:bg-canvas max-md:shadow-none'
            : 'bg-transparent shadow-none',
        )}
      >
        <Link href={href} className="flex items-center gap-2 pl-2 sm:pl-0">
          <Logo />
          {badge}
        </Link>
        <div className="hidden justify-center md:flex">{center}</div>
        <div className="col-start-3 flex min-w-0 items-center justify-end gap-1.5 sm:gap-3 md:col-start-auto">
          {right}
        </div>
      </div>
    </header>
  );
}
