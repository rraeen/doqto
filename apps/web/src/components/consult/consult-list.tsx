'use client';

import type { ChatThread } from '@doqto/shared';
import { CalendarDays, ChevronRight, LogIn, MessageCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { mediaSrc } from '@/lib/media';
import { Avatar } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useChats } from '@/lib/chat';
import { useMe } from '@/lib/session';

export function useWhenShort() {
  const { locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return (iso: string) => {
    const d = new Date(iso);
    const day = (x: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(x);
    if (day(d) === day(new Date())) {
      return new Intl.DateTimeFormat(tag, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }).format(d);
    }
    return new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  };
}

function ChatCard({ c, specialties }: { c: ChatThread; specialties: Record<string, string> }) {
  const { t } = useI18n();
  const when = useWhenShort();
  const last = c.lastMessage;
  return (
    <li>
      <Link
        href={`/consult/${c.appointmentId}`}
        className={cn(
          'neu-card flex items-center gap-4 rounded-2xl border-2 p-4 transition-shadow sm:gap-6 sm:p-5',
          c.unread > 0 ? 'border-brand-500/60' : 'border-transparent',
          !c.open && 'opacity-80',
        )}
      >
        <Avatar className="size-14 sm:size-20" online={c.open} src={mediaSrc(c.photoUrl)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-lg font-bold text-ink sm:text-xl">{c.withName}</h3>
            {last && (
              <span className="shrink-0 text-xs font-medium text-ink-muted">{when(last.at)}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-brand-700">
            {c.specialty ? (specialties[c.specialty] ?? c.specialty) : ''}
            {!c.open && ` · ${t('consult.closedShort')}`}
          </p>
          <p className="mt-1 truncate text-ink-muted">
            {last ? (
              <>
                {last.from === 'patient' ? `${t('consult.you')}: ` : ''}
                {last.text}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 italic">
                <CalendarDays className="size-4" aria-hidden />
                {t('consult.noMessagesYet')}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          {c.unread > 0 && (
            <span
              aria-label={t('consult.unread', { count: c.unread })}
              className="neu-glow flex size-7 items-center justify-center rounded-full text-xs font-bold"
            >
              {c.unread}
            </span>
          )}
          <ChevronRight className="size-5 text-ink-muted" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

/** The conversations with the doctors of the patient's accepted bookings. */
export function ConsultList({ specialties }: { specialties: Record<string, string> }) {
  const { t } = useI18n();
  const me = useMe();
  const signedIn = Boolean(me.data);
  const chats = useChats(signedIn);
  const items = chats.data?.items ?? [];
  const active = items.filter((c) => c.open);
  const closed = items.filter((c) => !c.open);

  let body;
  if (me.isPending || (signedIn && chats.isPending)) {
    body = (
      <div className="space-y-5" aria-busy>
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  } else if (!signedIn) {
    body = (
      <EmptyState
        icon={LogIn}
        title={t('consult.signIn')}
        action={
          <Link
            href="/login?next=%2Fconsult"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  } else if (chats.isError) {
    body = <EmptyState icon={MessageCircle} title={t('consult.loadFailed')} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={MessageCircle}
        title={t('consult.noChats')}
        description={t('consult.noChatsBody')}
        action={
          <Link
            href="/search"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.findDoctors')}
          </Link>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-10">
        {active.length > 0 && (
          <section aria-labelledby="active" className="space-y-5">
            <h2 id="active" className="text-xl font-bold text-ink">
              {t('consult.activeTitle')}
            </h2>
            <ul className="space-y-5">
              {active.map((c) => (
                <ChatCard key={c.appointmentId} c={c} specialties={specialties} />
              ))}
            </ul>
          </section>
        )}
        {closed.length > 0 && (
          <section aria-labelledby="past" className="space-y-3">
            <h2 id="past" className="text-xl font-bold text-ink">
              {t('consult.pastTitle')}
            </h2>
            <ul className="space-y-3">
              {closed.map((c) => (
                <ChatCard key={c.appointmentId} c={c} specialties={specialties} />
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {t('consult.title')}
        </h1>
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          {t('consult.subtitle')}
        </p>
      </div>
      {signedIn && (
        <p
          role="note"
          className="rounded-md bg-warning-bg px-4 py-2 text-sm font-medium text-warning"
        >
          {t('consult.emergencyBody')}
        </p>
      )}
      <div aria-live="polite">{body}</div>
    </div>
  );
}
