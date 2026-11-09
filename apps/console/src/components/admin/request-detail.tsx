'use client';

import { Button } from '@doqto/ui/button';
import { Field, Textarea } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import {
  SPECIALTIES,
  UNIT_FORMS,
  NOTE_MIN_LENGTH,
  type ApplicationDecisionRequest,
} from '@doqto/shared';
import { isApiError } from '@doqto/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/i18n/admin';
import { basePath } from '@/lib/admin-config';
import { authErrorKey, decideApplication, getApplication } from '@/lib/admin-api';
import { FORM_LABELS } from '@/lib/form-labels';
import { unitStatusTone } from '@/lib/unit-status';
import { formatWhen } from './requests-list';

function show(key: string, value: unknown, yes: string, no: string): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? yes : no;
  if (key === 'specialty') return SPECIALTIES.find((s) => s.key === value)?.en ?? String(value);
  return String(value);
}

/** One application: what the applicant submitted, who they are, and the three decisions. */
export function RequestDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'application', id], queryFn: () => getApplication(id) });
  const [mode, setMode] = useState<'request_changes' | 'reject'>();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();

  const decide = useMutation({
    mutationFn: (input: ApplicationDecisionRequest) => decideApplication(id, input),
    onSuccess: async (data) => {
      queryClient.setQueryData(['admin', 'application', id], data);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
      setMode(undefined);
      setNote('');
    },
  });

  const back = (
    <Link
      href={basePath + '/requests'}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('request.back')}
    </Link>
  );

  if (q.isPending) {
    return (
      <>
        {back}
        <p role="status" className="text-sm text-ink-muted">
          {t('common.loading')}
        </p>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {back}
        <p role="alert" className="text-sm text-danger">
          {t('request.notFound')}
        </p>
      </>
    );
  }

  const a = q.data;
  const waiting = a.status === 'pending';
  // An approved application can still be sent back or rejected (to take it off the site).
  const reversible = waiting || a.status === 'verified';
  const yes = t('request.yes');
  const no = t('request.no');

  function send() {
    if (!mode) return;
    if (note.trim().length < NOTE_MIN_LENGTH) {
      setNoteError(t('request.noteShort'));
      return;
    }
    setNoteError(undefined);
    decide.mutate({ decision: mode, note: note.trim() });
  }

  return (
    <>
      {back}
      <PageHeader
        eyebrow={t(('kindLabel.' + a.kind) as Parameters<typeof t>[0])}
        title={a.name}
        actions={
          <StatusChip tone={unitStatusTone[a.status]}>
            {t(('unitStatus.' + a.status) as Parameters<typeof t>[0])}
          </StatusChip>
        }
      />

      {reversible ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {waiting && (
            <Button
              size="sm"
              loading={decide.isPending && decide.variables?.decision === 'approve'}
              disabled={decide.isPending}
              onClick={() => decide.mutate({ decision: 'approve' })}
            >
              {t('request.approve')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={decide.isPending}
            onClick={() => setMode('request_changes')}
          >
            {t('request.changes')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={decide.isPending}
            onClick={() => setMode('reject')}
          >
            {t('request.reject')}
          </Button>
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink-muted">{t('request.decided')}</p>
      )}
      {decide.isError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {isApiError(decide.error, 'VALIDATION_FAILED') &&
          Array.isArray(decide.error.details.issues)
            ? t('request.incomplete', {
                fields: (decide.error.details.issues as { path: string }[])
                  .map((i) => FORM_LABELS[a.kind][i.path] ?? i.path)
                  .join(', '),
              })
            : t(authErrorKey(decide.error))}
        </p>
      )}
      {a.status === 'verified' && a.kind === 'clinic' && (
        <p className="mb-4 text-sm text-success">{t('request.listed')}</p>
      )}

      {mode && (
        <Panel
          className="mb-4"
          title={t(mode === 'reject' ? 'request.rejectTitle' : 'request.changesTitle')}
        >
          <div className="space-y-3 p-4">
            <Field label={t('request.noteLabel')} hint={t('request.noteHint')} error={noteError}>
              {({ id: fid, describedBy, invalid }) => (
                <Textarea
                  id={fid}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'reject' ? 'danger' : 'primary'}
                loading={decide.isPending}
                onClick={send}
              >
                {t(mode === 'reject' ? 'request.reject' : 'request.changes')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode(undefined)}>
                {t('request.cancel')}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={t('request.profile')}>
            <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
              {UNIT_FORMS[a.kind].map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {FORM_LABELS[a.kind][f.key] ?? f.key}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                    {show(f.key, a.profile[f.key], yes, no)}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={t('request.documents')}>
            <p className="p-4 text-sm text-ink-muted">{t('request.documentsLater')}</p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t('request.applicant')}>
            <dl className="space-y-3 p-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('request.name')}
                </dt>
                <dd className="text-ink">{a.applicant.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('request.contact')}
                </dt>
                <dd className="break-all text-ink">
                  {a.applicant.email ?? a.applicant.phone ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {t('request.submitted')}
                </dt>
                <dd className="text-ink">{formatWhen(a.submittedAt)}</dd>
              </div>
              {a.reviewedAt && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t('request.reviewed')}
                  </dt>
                  <dd className="text-ink">{formatWhen(a.reviewedAt)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          {a.reviewNote && (
            <Panel title={t('request.lastNote')}>
              <p className="whitespace-pre-wrap p-4 text-sm text-ink">{a.reviewNote}</p>
            </Panel>
          )}

          <Panel title={t('request.siblings')}>
            {a.siblings.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">{t('request.noSiblings')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {a.siblings.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <Link
                      href={basePath + '/requests/' + s.id}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      {t(('kindLabel.' + s.kind) as Parameters<typeof t>[0])}: {s.name}
                    </Link>
                    <StatusChip tone={unitStatusTone[s.status]}>
                      {t(('unitStatus.' + s.status) as Parameters<typeof t>[0])}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
