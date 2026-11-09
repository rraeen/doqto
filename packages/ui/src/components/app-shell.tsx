'use client';

import { Menu, X, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '../cn';

export interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface AppShellProps {
  /** Product name next to the logo, e.g. "Doqto Console". */
  productName: string;
  /** Logo or mark shown before the product name. */
  logo?: ReactNode;
  /** "ADMIN" and similar: a visible reminder of which app this is. */
  environmentTag?: string;
  /** `admin` gets a dark top bar so nobody mistakes it for the console. */
  tone?: 'console' | 'admin';
  nav: NavGroup[];
  /** Current URL path; the longest matching nav item is highlighted. */
  activePath: string;
  /** The router's link component (`next/link`); a plain anchor by default. */
  LinkComponent?: ElementType;
  /** Left of the top bar, after the menu button: workspace switcher. */
  workspace?: ReactNode;
  /** Right of the top bar: language switch, notifications, account menu. */
  topbar?: ReactNode;
  skipLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  children: ReactNode;
}

/** The nav item whose href is the longest prefix of the path, or undefined. */
export function activeNavHref(nav: NavGroup[], path: string): string | undefined {
  let best: string | undefined;
  for (const item of nav.flatMap((g) => g.items)) {
    const matches = path === item.href || path.startsWith(item.href.replace(/\/$/, '') + '/');
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

/**
 * Desktop-first app frame: fixed sidebar on large screens, a drawer on tablets and phones, a top
 * bar for the workspace switcher and account controls, and a content area.
 */
export function AppShell({
  productName,
  logo,
  environmentTag,
  tone = 'console',
  nav,
  activePath,
  LinkComponent = 'a',
  workspace,
  topbar,
  skipLabel = 'Skip to content',
  openMenuLabel = 'Open menu',
  closeMenuLabel = 'Close menu',
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const active = activeNavHref(nav, activePath);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sidebar = (
    <nav aria-label={productName} className="flex h-full flex-col gap-6 overflow-y-auto p-3">
      {nav.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label && (
            <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.href === active;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <LinkComponent
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )}
                  >
                    {Icon && <Icon className="size-[18px] shrink-0" aria-hidden />}
                    <span className="truncate">{item.label}</span>
                  </LinkComponent>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-white focus:px-3 focus:py-2"
      >
        {skipLabel}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          {logo}
          <span className="truncate text-base font-bold text-ink">{productName}</span>
        </div>
        <div className="h-[calc(100%-3.5rem)]">{sidebar}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={closeMenuLabel}
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label={productName}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-lg"
          >
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="truncate text-base font-bold text-ink">{productName}</span>
              <button
                type="button"
                aria-label={closeMenuLabel}
                className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">{sidebar}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header
          className={cn(
            'sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-3 sm:px-5',
            tone === 'admin' ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink',
          )}
        >
          <button
            type="button"
            aria-label={openMenuLabel}
            aria-expanded={open}
            aria-controls={drawerId}
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-sm lg:hidden',
              tone === 'admin' ? 'hover:bg-white/10' : 'hover:bg-surface',
            )}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
          {environmentTag && (
            <span className="rounded-sm bg-brand-500 px-2 py-0.5 text-2xs font-bold tracking-wider text-ink">
              {environmentTag}
            </span>
          )}
          <div className="min-w-0 flex-1">{workspace}</div>
          <div className="flex items-center gap-2">{topbar}</div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
