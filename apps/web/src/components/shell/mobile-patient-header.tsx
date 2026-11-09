'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountChip } from '@/components/shell/account-chip';
import { Logo } from '@/components/shell/logo';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { useScrolled } from '@/components/shell/use-scrolled';
import { cn } from '@/lib/cn';

function isConsultChatPath(pathname: string) {
  return /^\/consult\/[^/]+/.test(pathname);
}

/** Phones: logo, notifications, account — same bar on home and all patient routes. */
export function MobilePatientHeader() {
  const pathname = usePathname();
  const scrolled = useScrolled();
  if (isConsultChatPath(pathname)) return null;

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-[background] duration-300 md:hidden',
        scrolled ? 'mobile-home-bar-scrolled' : 'mobile-home-bar-top',
      )}
    >
      <Link href="/" aria-label="Doqto" className="min-w-0 shrink">
        <Logo />
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationsBell />
        <AccountChip />
      </div>
    </header>
  );
}
