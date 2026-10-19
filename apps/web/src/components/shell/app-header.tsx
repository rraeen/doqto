import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './logo';

export function AppHeader({
  href = '/',
  badge,
  right,
}: {
  href?: string;
  badge?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
        <Link href={href} className="flex items-center gap-2">
          <Logo />
          {badge}
        </Link>
        {right}
      </div>
    </header>
  );
}
