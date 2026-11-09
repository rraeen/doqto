'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useUnreadCount } from '@/lib/notifications';
import { useMe } from '@/lib/session';

/** Opens the inbox. A badge shows how many messages have not been read yet (up to 9+). */
export function NotificationsBell({ className }: { className?: string }) {
  const t = useT();
  const me = useMe();
  const unread = useUnreadCount(Boolean(me.data)).data ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `${t('nav.notifications')} (${unread})` : t('nav.notifications')}
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center text-brand-700 transition-colors hover:text-brand-600',
        className,
      )}
    >
      <Bell className="size-5" aria-hidden strokeWidth={2} />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
