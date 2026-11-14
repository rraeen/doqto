'use client';

import type { LabConsoleBooking } from '@doqto/shared';
import { Button } from '@doqto/ui/button';
import { EmptyState } from '@doqto/ui/empty-state';
import { Field, Textarea } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import { canOpenArea } from '@/lib/app-config';
import { decideLabBooking, labBookingsKey, progressLabBooking } from '@/lib/lab-api';
import { BookingFacts, useLabBookings, useLabErrorText, useLabUnit } from './lab-shared';

type Tab = 'requests' | 'open' | 'all';
const OPEN = ['accepted', 'sample_collected', 'processing', 'report_ready'];

function BookingRow({ b, unitId, canDecide }: { b: LabConsoleBooking; unitId: string; canDecide: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useLabErrorText();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const done = (text: string) => async () => {
    await queryClient.invalidateQueries({ queryKey: labBookingsKey(unitId) });
    setRejecting(false);
    setReason('');
    setMessage({ ok: true, text });
  };
  const fail = (err: unknown) => setMessage({ ok: false, text: errorText(err) });

  const accept = useMutation({
    mutationFn: () => decideLabBooking(unitId, b.id, { decision: 'accept' }),
    onSuccess: done(t('lab.bookings.accepted')),
    onError: fail,
  });
  const reject = useMutation({
    mutationFn: () => decideLabBooking(unitId, b.id, { decision: 'reject', reason: reason.trim() }),
    onSuccess: done(t('lab.bookings.rejected')),
    onError: fail,
  });
  const close = useMutation({
    mutationFn: () => progressLabBooking(unitId, b.id, 'completed'),
    onSuccess: done(t('lab.bookings.closed')),
    onError: fail,
  });

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BookingFacts b={b} />
        {canDecide && (
          <div className="flex flex-wrap gap-2">
            {b.status === 'requested' && (
              <>
                <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>
                  {t('lab.bookings.accept')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(!rejecting)}>
                  {t('lab.bookings.reject')}
                </Button>
              </>
            )}
            {b.status === 'report_ready' && (
              <Button size="sm" variant="outline" loading={close.isPending} onClick={() => close.mutate()}>
                {t('lab.bookings.close')}
              </Button>
            )}
          </div>
        )}
      </div>
      {rejecting && (
        <form
          className="space-y-3 rounded-sm border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length >= 3) reject.mutate();
          }}
        >
          <Field label={t('lab.bookings.rejectTitle')} hint={t('lab.bookings.rejectHint')}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <Button size="sm" variant="danger" type="submit" loading={reject.isPending} disabled={reason.trim().length < 3}>
            {t('lab.bookings.rejectSend')}
          </Button>
        </form>
      )}
      {message && (
        <p role="status" className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
          {message.text}
        </p>
      )}
    </li>
  );
}

/** The lab's booking requests: accept or reject what patients asked for, and close finished ones. */
export function LabBookingsScreen() {
  const t = useT();
  const { unitId, unit } = useLabUnit();
  const bookings = useLabBookings(unitId);
  const [tab, setTab] = useState<Tab>('requests');
  const canDecide = Boolean(unit && canOpenArea('labBookings', unit));
  const all = bookings.data?.items ?? [];
  const shown = all.filter((b) =>
    tab === 'requests' ? b.status === 'requested' : tab === 'open' ? OPEN.includes(b.status) : true,
  );
  const tabs: [Tab, string][] = [
    ['requests', t('lab.bookings.tabRequests')],
    ['open', t('lab.bookings.tabOpen')],
    ['all', t('lab.bookings.tabAll')],
  ];

  return (
    <>
      <PageHeader title={t('areas.labBookings.title')} description={t('lab.bookings.intro')} />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map(([key, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            size="sm"
            variant={tab === key ? 'primary' : 'outline'}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'requests' && ` (${all.filter((b) => b.status === 'requested').length})`}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => bookings.refetch()}>
          {t('lab.refresh')}
        </Button>
      </div>
      <Panel>
        {bookings.isPending ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : bookings.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : shown.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={t('lab.bookings.none')} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((b) => (
              <BookingRow key={b.id} b={b} unitId={unitId!} canDecide={canDecide} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
