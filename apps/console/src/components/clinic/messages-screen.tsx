'use client';

import { Button } from '@doqto/ui/button';
import { cn } from '@doqto/ui/cn';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { CHAT_TEXT_MAX, type ChatThread } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '@/i18n/provider';
import { chatKey, chatsKey, getChat, getChats, sendChatMessage } from '@/lib/auth';
import { formatTime } from '@/lib/dates';
import { useClinicUnit } from './schedule-editor';

const dayOf = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

function shortWhen(iso: string, today: string): string {
  return dayOf(iso) === today
    ? formatTime(iso)
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso));
}

function ThreadRow({
  c,
  selected,
  onPick,
}: {
  c: ChatThread;
  selected: boolean;
  onPick: () => void;
}) {
  const t = useT();
  const today = dayOf(new Date().toISOString());
  const last = c.lastMessage;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface',
          selected && 'bg-surface',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold text-ink">{c.withName}</span>
            {last && (
              <span className="shrink-0 text-xs text-ink-muted">{shortWhen(last.at, today)}</span>
            )}
          </span>
          <span className="block truncate text-sm text-ink-muted">
            {last
              ? `${last.from === 'doctor' ? `${t('messages.you')}: ` : ''}${last.text}`
              : t('messages.empty')}
          </span>
        </span>
        {c.unread > 0 && (
          <span className="mt-0.5 shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
            {t('messages.newCount', { n: c.unread })}
          </span>
        )}
      </button>
    </li>
  );
}

function Conversation({
  unitId,
  appointmentId,
  onBack,
}: {
  unitId: string;
  appointmentId: string;
  onBack: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const today = dayOf(new Date().toISOString());

  const chat = useQuery({
    queryKey: chatKey(unitId, appointmentId),
    queryFn: () => getChat(unitId, appointmentId),
    refetchInterval: 5_000,
  });
  const send = useMutation({
    mutationFn: (text: string) => sendChatMessage(unitId, appointmentId, text),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['console', 'chats', unitId] });
    },
  });

  // Opening the thread reads it on the server, so the list's "new" count must follow.
  const count = chat.data?.messages.length ?? 0;
  const loaded = chat.isSuccess;
  useEffect(() => {
    if (loaded) void queryClient.invalidateQueries({ queryKey: chatsKey(unitId), exact: true });
  }, [count, loaded, queryClient, unitId]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text && !send.isPending) send.mutate(text);
  };

  if (chat.isPending) return <p className="p-4 text-sm text-ink-muted">…</p>;
  if (chat.isError || !chat.data) {
    return <p className="p-4 text-sm text-danger">{t('messages.loadFailed')}</p>;
  }
  const { thread, messages } = chat.data;
  const visit = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${thread.appointmentDate}T12:00:00+05:30`));

  return (
    <div className="flex h-[min(34rem,70dvh)] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('messages.back')}
          className="text-ink-muted hover:text-ink lg:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{thread.withName}</p>
          <p className="text-xs text-ink-muted">{t('messages.visitOn', { date: visit })}</p>
        </div>
      </div>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">{t('messages.empty')}</p>
        )}
        {messages.map((m, i) => {
          const d = dayOf(m.at);
          const prev = messages[i - 1];
          const showDay = !prev || dayOf(prev.at) !== d;
          const mine = m.from === 'doctor';
          return (
            <div key={m.id} className="space-y-2">
              {showDay && (
                <p className="text-center text-xs font-semibold text-ink-muted">
                  {d === today
                    ? t('messages.today')
                    : new Intl.DateTimeFormat('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(m.at))}
                </p>
              )}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm text-ink sm:max-w-[70%]',
                    mine ? 'bg-brand-500/15' : 'bg-surface',
                  )}
                >
                  <p className="whitespace-pre-line break-words">{m.text}</p>
                  <p className="mt-1 text-right text-xs text-ink-muted">{formatTime(m.at)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {thread.open ? (
        <form onSubmit={submit} className="border-t border-line p-3">
          {send.isError && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {t('messages.sendFailed')}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={CHAT_TEXT_MAX}
              rows={2}
              aria-label={t('messages.placeholder')}
              placeholder={t('messages.placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
              className="min-h-11 flex-1 resize-none rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <Button type="submit" loading={send.isPending} disabled={!draft.trim()}>
              <Send className="size-4" aria-hidden />
              {t('messages.send')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">
          {t('messages.closed')}
        </p>
      )}
    </div>
  );
}

/**
 * The doctor's conversations with patients who booked with them: the list on one side, the open
 * conversation on the other (one at a time on a phone). A thread exists once the booking is
 * accepted. Both lists refresh by themselves while the page is open.
 */
export function MessagesScreen() {
  const t = useT();
  const { unitId, loading } = useClinicUnit();
  const [selected, setSelected] = useState<string>();

  const list = useQuery({
    queryKey: chatsKey(unitId ?? ''),
    queryFn: () => getChats(unitId!),
    enabled: Boolean(unitId),
    refetchInterval: 10_000,
  });

  const header = (
    <PageHeader title={t('areas.messages.title')} description={t('areas.messages.description')} />
  );
  if (loading || (unitId && list.isPending)) {
    return (
      <>
        {header}
        <p className="text-sm text-ink-muted">…</p>
      </>
    );
  }
  if (!unitId) {
    return (
      <>
        {header}
        <Panel>
          <p className="text-sm text-ink-muted">{t('messages.noUnit')}</p>
        </Panel>
      </>
    );
  }
  const items = list.data?.items ?? [];

  return (
    <>
      {header}
      <p className="mb-4 text-sm text-ink-muted">{t('messages.note')}</p>
      {list.isError ? (
        <Panel>
          <p className="text-sm text-danger">{t('messages.loadFailed')}</p>
        </Panel>
      ) : items.length === 0 ? (
        <Panel title={t('messages.none')}>
          <p className="text-sm text-ink-muted">{t('messages.noneHint')}</p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Panel
            title={t('messages.listTitle')}
            className={cn('[&>div]:p-0', selected && 'max-lg:hidden')}
          >
            <ul className="divide-y divide-line">
              {items.map((c) => (
                <ThreadRow
                  key={c.appointmentId}
                  c={c}
                  selected={c.appointmentId === selected}
                  onPick={() => setSelected(c.appointmentId)}
                />
              ))}
            </ul>
          </Panel>
          <Panel className={cn('[&>div]:p-0', !selected && 'max-lg:hidden')}>
            {selected ? (
              <Conversation
                key={selected}
                unitId={unitId}
                appointmentId={selected}
                onBack={() => setSelected(undefined)}
              />
            ) : (
              <p className="p-6 text-sm text-ink-muted">{t('messages.pick')}</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
