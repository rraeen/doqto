'use client';

import type { MyNotification } from '@doqto/shared';
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  Clock,
  Star,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/use-now';
import { useMarkAllRead, useNotifications } from '@/lib/notifications';

const ICONS: Record<string, LucideIcon> = {
  booking_confirmed: CalendarCheck,
  reminder_day_before: CalendarClock,
  reminder_two_hours: CalendarClock,
  doctor_running_late: Clock,
  turn_near: Clock,
  appointment_cancelled_by_clinic: CalendarClock,
  refund_processed: Wallet,
  late_payment_refunded: Wallet,
  review_open: Star,
  review_reminder: Star,
  review_replied: Star,
};

/** The page a message opens: the booking, or its review form for the review messages. */
export function targetOf(n: Pick<MyNotification, 'template' | 'appointmentId'>): string | null {
  if (!n.appointmentId) return null;
  return n.template.startsWith('review_')
    ? `/appointments/${n.appointmentId}/review`
    : `/appointments/${n.appointmentId}`;
}

function ago(iso: string, locale: 'en' | 'hi', now: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    numeric: 'auto',
  });
  if (now === 0) return '';
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86_400), 'day');
}

function Row({ n, locale, now }: { n: MyNotification; locale: 'en' | 'hi'; now: number }) {
  const Icon = ICONS[n.template] ?? Bell;
  const href = targetOf(n);
  const body = (
    <Card className={cn('flex gap-3', href && 'transition-opacity hover:opacity-90')}>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink">{n.text}</p>
        <p className="mt-1 text-xs text-ink-muted">{ago(n.createdAt, locale, now)}</p>
      </div>
      {!n.read && (
        <span
          role="img"
          aria-label="unread"
          className="mt-1 size-2.5 shrink-0 rounded-full bg-brand-600"
        />
      )}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** The patient's inbox: every message sent to them, newest first. Opening it marks them read. */
export function NotificationsPage() {
  const { t, locale } = useI18n();
  const list = useNotifications();
  const markRead = useMarkAllRead();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const hasUnread = items.some((n) => !n.read);

  // Opening the inbox is reading it: clear the badge once the list has shown.
  const { mutate } = markRead;
  useEffect(() => {
    if (!hasUnread) return;
    const id = setTimeout(() => mutate(), 1500);
    return () => clearTimeout(id);
  }, [hasUnread, mutate]);

  const now = useNow();
  return (
    <>
      <PageTitle description={t('notificationsPage.subtitle')}>
        {t('notificationsPage.title')}
      </PageTitle>
      {list.isPending ? (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          icon={Bell}
          title={t('common.somethingWrong')}
          action={
            <Button variant="outline" onClick={() => void list.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t('notificationsPage.empty')}
          description={t('notificationsPage.emptyBody')}
        />
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id}>
                <Row n={n} locale={locale} now={now} />
              </li>
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                loading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {t('notificationsPage.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
