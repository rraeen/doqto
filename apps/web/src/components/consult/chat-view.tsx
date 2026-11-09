'use client';

import { CHAT_TEXT_MAX, type ChatMessage } from '@doqto/shared';
import { ArrowLeft, BadgeCheck, LogIn, MessageCircle, Mic, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { mediaSrc } from '@/lib/media';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { useChatThread } from '@/lib/chat';
import { useMe } from '@/lib/session';
import { useDictation } from './use-dictation';

const istDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

function Bubble({ m, time }: { m: ChatMessage; time: string }) {
  const mine = m.from === 'patient';
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-base text-ink sm:max-w-[70%]',
          mine ? 'rounded-br-md bg-brand-500/20' : 'rounded-bl-md bg-white shadow-sm',
        )}
      >
        <p className="whitespace-pre-line break-words">{m.text}</p>
        <p className="mt-1 text-right text-2xs text-ink-muted">{time}</p>
      </div>
    </li>
  );
}

/** A conversation with the doctor of one accepted booking. The id is the booking's id. */
export function ChatView({ id, specialties }: { id: string; specialties: Record<string, string> }) {
  const { t, locale } = useI18n();
  const me = useMe();
  const signedIn = Boolean(me.data);
  const { thread, messages, state, send } = useChatThread(id, signedIn);
  const [draft, setDraft] = useState('');
  const voice = useDictation(
    locale === 'hi' ? 'hi-IN' : 'en-IN',
    (spoken) =>
      setDraft((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}${spoken}`.slice(0, CHAT_TEXT_MAX)),
    (code) =>
      toast.error(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? t('consult.micDenied')
          : t('consult.micFailed'),
      ),
  );
  const scroller = useRef<HTMLDivElement>(null);
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';

  // Only the message list scrolls, never the page behind it.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, []);

  const count = messages.length;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, state]);

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat(tag, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  const dayLabel = (iso: string) =>
    istDay(iso) === istDay(new Date().toISOString())
      ? t('consult.today')
      : new Intl.DateTimeFormat(tag, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        }).format(new Date(iso));

  const items = useMemo(() => {
    const out: Array<
      { kind: 'day'; key: string; label: string } | { kind: 'msg'; m: ChatMessage }
    > = [];
    let prev = '';
    for (const m of messages) {
      const d = istDay(m.at);
      if (d !== prev) {
        out.push({ kind: 'day', key: d, label: d });
        prev = d;
      }
      out.push({ kind: 'msg', m });
    }
    return out;
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => setDraft(''),
      onError: () => toast.error(t('consult.sendFailed')),
    });
  };

  if (me.isPending || (signedIn && state === 'loading')) {
    return <Skeleton className="h-[28rem] w-full rounded-xl" aria-busy />;
  }
  if (!signedIn) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('consult.signIn')}
        action={
          <Link
            href={`/login?next=${encodeURIComponent(`/consult/${id}`)}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  if (state === 'missing' || state === 'error' || !thread) {
    return (
      <EmptyState
        icon={MessageCircle}
        title={state === 'error' ? t('consult.loadFailed') : t('consult.notFound')}
        action={
          <Link
            href="/consult"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('consult.back')}
          </Link>
        }
      />
    );
  }

  const visitDay = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${thread.appointmentDate}T12:00:00+05:30`));

  return (
    <div className="mx-auto w-full max-w-3xl max-lg:max-w-none">
      <section
        aria-label={thread.withName}
        className="flex flex-col overflow-hidden bg-canvas max-lg:fixed max-lg:inset-0 max-lg:z-30 max-lg:h-[100dvh] max-lg:min-h-0 lg:fixed lg:inset-x-4 lg:bottom-4 lg:top-24 lg:z-20 lg:mx-auto lg:max-w-3xl lg:rounded-2xl lg:border lg:border-line"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6">
          <Link
            href="/consult"
            aria-label={t('consult.back')}
            className="text-brand-700 hover:text-brand-600"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <Avatar className="size-12" online={thread.open} src={mediaSrc(thread.photoUrl)} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-bold text-ink">{thread.withName}</span>
              <span className="hidden items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-brand-700 sm:flex">
                <BadgeCheck className="size-3" aria-hidden />
                {t('consult.verified')}
              </span>
            </p>
            <p className="truncate text-sm font-medium text-brand-700">
              {thread.specialty ? `${specialties[thread.specialty] ?? thread.specialty} · ` : ''}
              {t('consult.visitOn', { date: visitDay })}
            </p>
          </div>
          {thread.doctorSlug && (
            <Link
              href={`/d/${thread.doctorSlug}`}
              className="hidden shrink-0 text-sm font-semibold text-brand-700 hover:underline sm:block"
            >
              {t('consult.viewProfile')}
            </Link>
          )}
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <p className="mb-4 rounded-md bg-warning-bg px-3 py-2 text-xs font-medium text-warning">
            {t('consult.emergencyBody')}
          </p>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">{t('consult.emptyThread')}</p>
          ) : (
            <ul aria-live="polite" className="space-y-2">
              {items.map((it) =>
                it.kind === 'day' ? (
                  <li key={`d-${it.key}`} className="text-center">
                    <span className="neu-inset rounded-full px-4 py-1 text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      {dayLabel(`${it.key}T12:00:00+05:30`)}
                    </span>
                  </li>
                ) : (
                  <Bubble key={it.m.id} m={it.m} time={timeOf(it.m.at)} />
                ),
              )}
            </ul>
          )}
        </div>

        {thread.open ? (
          <form
            onSubmit={submit}
            className="shrink-0 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4 lg:pb-4"
          >
            <div className="flex items-center gap-3">
              <label className="neu-inset flex min-w-0 flex-1 items-center rounded-full px-4 py-2.5 sm:px-5 sm:py-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={CHAT_TEXT_MAX}
                  aria-label={t('consult.composerLabel')}
                  placeholder={t('consult.composerPlaceholder')}
                  className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted/60 focus:outline-none"
                />
                {voice.supported && (
                  <button
                    type="button"
                    onClick={voice.toggle}
                    aria-pressed={voice.listening}
                    aria-label={voice.listening ? t('consult.micStop') : t('consult.micStart')}
                    className={cn(
                      'ml-2 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
                      voice.listening
                        ? 'animate-pulse bg-red-500 text-white'
                        : 'text-ink-muted hover:text-brand-700',
                    )}
                  >
                    <Mic className="size-5" aria-hidden />
                  </button>
                )}
              </label>
              <Button
                type="submit"
                className="size-11 shrink-0 rounded-full p-0"
                disabled={!draft.trim() || send.isPending}
                aria-label={t('consult.send')}
              >
                <Send className="size-5" aria-hidden />
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex shrink-0 flex-col items-center gap-3 border-t border-line px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:pb-4">
            <p className="text-sm text-ink-muted">{t('consult.closed')}</p>
            <Link
              href={thread.doctorSlug ? `/d/${thread.doctorSlug}` : '/search'}
              className={buttonVariants({ variant: 'outline', className: 'px-6' })}
            >
              {t('consult.bookVisit')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
