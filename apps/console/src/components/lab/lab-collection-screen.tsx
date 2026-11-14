'use client';

import type { LabConsoleBooking } from '@doqto/shared';
import { Button } from '@doqto/ui/button';
import { EmptyState } from '@doqto/ui/empty-state';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { inputClass } from '@doqto/ui/input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TestTube } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import { canOpenArea } from '@/lib/app-config';
import {
  assignLabCollector,
  getLabCollectors,
  labBookingsKey,
  labCollectorsKey,
  progressLabBooking,
} from '@/lib/lab-api';
import { BookingFacts, useLabBookings, useLabErrorText, useLabUnit } from './lab-shared';

function CollectionRow({
  b,
  unitId,
  collectors,
  canCollect,
}: {
  b: LabConsoleBooking;
  unitId: string;
  collectors: { accountId: string; name: string }[];
  canCollect: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useLabErrorText();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: labBookingsKey(unitId) });
  const fail = (err: unknown) => setMessage({ ok: false, text: errorText(err) });

  const assign = useMutation({
    mutationFn: (accountId: string | null) => assignLabCollector(unitId, b.id, accountId),
    onSuccess: async () => {
      await refresh();
      setMessage({ ok: true, text: t('lab.collection.done') });
    },
    onError: fail,
  });
  const step = useMutation({
    mutationFn: (s: 'collected' | 'no_show') => progressLabBooking(unitId, b.id, s),
    onSuccess: async () => {
      await refresh();
      setMessage({ ok: true, text: t('lab.collection.done') });
    },
    onError: fail,
  });

  return (
    <li className="space-y-3 py-4">
      <BookingFacts b={b} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-ink-muted" htmlFor={`assign-${b.id}`}>
          {t('lab.collection.assign')}
        </label>
        <select
          id={`assign-${b.id}`}
          className={inputClass + ' max-w-56'}
          value={b.assignedTo?.accountId ?? ''}
          disabled={!canCollect || b.status !== 'accepted' || assign.isPending}
          onChange={(e) => assign.mutate(e.target.value || null)}
        >
          <option value="">{t('lab.collection.unassigned')}</option>
          {collectors.map((c) => (
            <option key={c.accountId} value={c.accountId}>
              {c.name}
            </option>
          ))}
        </select>
        {canCollect && b.status === 'accepted' && (
          <>
            <Button size="sm" loading={step.isPending && step.variables === 'collected'} onClick={() => step.mutate('collected')}>
              {t('lab.collection.collected')}
            </Button>
            <Button size="sm" variant="outline" loading={step.isPending && step.variables === 'no_show'} onClick={() => step.mutate('no_show')}>
              {t('lab.collection.noShow')}
            </Button>
          </>
        )}
      </div>
      {message && (
        <p role="status" className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
          {message.text}
        </p>
      )}
    </li>
  );
}

/** Accepted bookings waiting for a sample: who collects, and when the sample is in hand. */
export function LabCollectionScreen() {
  const t = useT();
  const { unitId, unit } = useLabUnit();
  const canCollect = Boolean(unit && canOpenArea('collection', unit));
  const bookings = useLabBookings(unitId, canCollect);
  const collectors = useQuery({
    queryKey: labCollectorsKey(unitId ?? ''),
    queryFn: () => getLabCollectors(unitId!),
    enabled: Boolean(unitId) && canCollect,
  });
  // Soonest first: today's collections on top.
  const waiting = (bookings.data?.items ?? [])
    .filter((b) => b.status === 'accepted')
    .sort((a, b) => a.collection.date.localeCompare(b.collection.date));

  return (
    <>
      <PageHeader title={t('areas.collection.title')} description={t('lab.collection.intro')} />
      <Panel>
        {bookings.isPending ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : bookings.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : waiting.length === 0 ? (
          <EmptyState icon={TestTube} title={t('lab.collection.none')} />
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((b) => (
              <CollectionRow
                key={b.id}
                b={b}
                unitId={unitId!}
                collectors={collectors.data?.items ?? []}
                canCollect={canCollect}
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
