'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (for section roots like `/` or `/clinic`). */
  exact?: boolean;
}

export function isActive(pathname: string, item: Pick<NavItem, 'href' | 'exact'>) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 md:hidden"
    >
      <ul className="neu-raised flex w-full max-w-md rounded-full px-3">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-[4.5rem] flex-col items-center justify-center gap-0.5 text-2xs font-semibold transition-opacity',
                  active ? 'text-brand-700' : 'text-ink-muted hover:text-ink',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full transition-shadow',
                    active && 'neu-inset',
                  )}
                >
                  <Icon className="size-5" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop links for the header; hidden on phones, where `BottomNav` is used. */
export function TopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition-shadow',
                  active ? 'neu-inset text-brand-700' : 'text-ink hover:text-brand-600',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
