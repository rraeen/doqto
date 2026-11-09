'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { NavInstall } from './nav-install';

interface NavMenuProps {
  label: string;
  items: Array<{ href: string; label: string; primary?: boolean; install?: boolean }>;
  /** Label of the main button once the app is installed. */
  findLabel: string;
}

/** Phone-width menu for the landing nav, where the inline links do not fit. */
export function NavMenu({ label, items, findLabel }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="neu-raised flex size-10 items-center justify-center rounded-full text-ink active:shadow-[inset_4px_4px_8px_#bcc7bc,inset_-4px_-4px_8px_#ffffff]"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label={label}
          className="neu-card absolute inset-x-0 top-full mt-3 flex flex-col gap-2 rounded-[2rem] p-4"
        >
          {items.map((item) => {
            const className = item.primary
              ? 'neu-glow flex h-12 items-center justify-center rounded-full font-extrabold'
              : 'flex h-12 items-center rounded-full px-5 font-bold text-ink hover:bg-brand-500/10';
            return item.install ? (
              <NavInstall
                key={item.href}
                installLabel={item.label}
                findLabel={findLabel}
                className={className}
                onDone={() => setOpen(false)}
              />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={className}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
