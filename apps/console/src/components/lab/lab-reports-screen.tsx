'use client';

import { isApiError } from '@doqto/api-client';
import type { LabConsoleBooking } from '@doqto/shared';
import { Button } from '@doqto/ui/button';
import { EmptyState } from '@doqto/ui/empty-state';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/provider';
import { labBookingsKey, progressLabBooking, uploadLabReport } from '@/lib/lab-api';
import { BookingFacts, useLabBookings, useLabErrorText, useLabUnit } from './lab-shared';

const IN_LAB = ['sample_collected', 'processing', 'report_ready'];

function ReportRow({ b, unitId, enabled }: { b: LabConsoleBooking; unitId: string; enabled: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useLabErrorText();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: labBookingsKey(unitId) });

  const start = useMutation({
    mutationFn: () => progressLabBooking(unitId, b.id, 'processing'),
    onSuccess: refresh,
    onError: (err) => setMessage({ ok: false, text: errorText(err) }),
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadLabReport(unitId, b.id, file),
    onSuccess: async () => {
      await refresh();
      setMessage({ ok: true, text: t('lab.reports.uploaded') });
    },
    onError: (err) =>
      setMessage({
        ok: false,
        text: isApiError(err, 'VALIDATION_FAILED') ? t('lab.reports.errFile') : errorText(err),
      }),
  });

  return (
    <li className="space-y-3 py-4">
      <BookingFacts b={b} />
      {b.reportUploadedAt && (
        <p className="text-sm text-success">
          {t('lab.reports.sentOn', { date: new Date(b.reportUploadedAt).toLocaleDateString('en-IN') })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {b.status === 'sample_collected' && (
          <Button size="sm" variant="outline" loading={start.isPending} onClick={() => start.mutate()}>
            {t('lab.reports.start')}
          </Button>
        )}
        {enabled && (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={t('lab.reports.upload')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
            <Button size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>
              {b.status === 'report_ready' ? t('lab.reports.replace') : t('lab.reports.upload')}
            </Button>
            <span className="text-xs text-ink-muted">{t('lab.reports.fileHint')}</span>
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

/** Samples in the lab: start the work, then send the patient their report. */
export function LabReportsScreen() {
  const t = useT();
  const { unitId } = useLabUnit();
  const bookings = useLabBookings(unitId);
  const enabled = bookings.data?.reportsEnabled ?? false;
  const inLab = (bookings.data?.items ?? []).filter((b) => IN_LAB.includes(b.status));

  return (
    <>
      <PageHeader title={t('areas.reports.title')} description={t('lab.reports.intro')} />
      {bookings.data && !enabled && (
        <p role="status" className="mb-4 rounded-sm bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('lab.reports.off')}
        </p>
      )}
      <Panel>
        {bookings.isPending ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : bookings.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : inLab.length === 0 ? (
          <EmptyState icon={FileText} title={t('lab.reports.none')} />
        ) : (
          <ul className="divide-y divide-line">
            {inLab.map((b) => (
              <ReportRow key={b.id} b={b} unitId={unitId!} enabled={enabled} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
