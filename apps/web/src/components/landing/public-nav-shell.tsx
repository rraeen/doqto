'use client';

import type { ReactNode } from 'react';
import { useScrolled } from '@/components/shell/use-scrolled';
import { cn } from '@/lib/cn';

/** Landing / marketing nav: flat at top, neumorphic pill after scroll (matches signed-in `AppHeader`). */
export function PublicNavShell({ children }: { children: ReactNode }) {
  const scrolled = useScrolled();
  return (
    // On phones the bar is a full-width strip from the very top edge, with no gap around it.
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center bg-transparent sm:top-5 sm:px-6">
      <header
        className={cn(
          'relative grid w-full max-w-[1100px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 transition-[background-color,box-shadow,border-radius] duration-300 max-md:pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6',
          // Phones match the signed-in header: flat, square-cornered, no border or shadow.
          scrolled
            ? 'neu-raised rounded-full max-md:rounded-none max-md:border-0 max-md:bg-canvas max-md:shadow-none'
            : 'rounded-none bg-transparent shadow-none',
        )}
      >
        {children}
      </header>
    </div>
  );
}
