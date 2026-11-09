'use client';

import { mediaSrc } from '@/lib/media';
import { Button } from '@doqto/ui/button';
import { Field, Textarea } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { NOTE_MIN_LENGTH, SPECIALTIES, type ProfileSnapshot } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/admin';
import { basePath } from '@/lib/admin-config';
import {
  authErrorKey,
  decideProfileChange,
  getProfileChange,
  listProfileChanges,
  profileChangesKey,
} from '@/lib/admin-api';
import { FORM_LABELS } from '@/lib/form-labels';
import { formatWhen } from './requests-list';

function label(key: string): string {
  return FORM_LABELS.clinic[key] ?? key;
}

function show(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (key === 'specialty') return SPECIALTIES.find((s) => s.key === value)?.en ?? String(value);
  return String(value);
}

function Avatar({ url }: { url: string | null }) {
  return (
    <span className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-ink-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaSrc(url)} alt="" className="size-full object-cover" />
      ) : (
        <UserRound className="size-7" aria-hidden />
      )}
    </span>
  );
}

/** Changes doctors made to their profile, waiting for approval, oldest first. */
export function ProfileChangesList() {
  const t = useT();
  const q = useQuery({ queryKey: profileChangesKey, queryFn: listProfileChanges });
  return (
    <>
      <PageHeader
        title={t('areas.profileChanges.title')}
        description={t('areas.profileChanges.description')}
      />
      <Panel>
        {q.isError ? (
          <p role="alert" className="p-4 text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : q.isPending ? (
          <p role="status" className="p-4 text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : q.data.items.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">{t('profileChanges.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t('profileChanges.colDoctor')}</th>
                  <th className="px-4 py-2 font-semibold">{t('profileChanges.colChanged')}</th>
                  <th className="px-4 py-2 font-semibold">{t('profileChanges.colSubmitted')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-ink">{c.name}</span>
                      <span className="block text-xs text-ink-muted">
                        {c.applicant.email ?? c.applicant.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {c.changedFields
                        .map(label)
                        .concat(c.photoChanged ? [t('profileChanges.photo')] : [])
                        .join(', ')}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatWhen(c.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={basePath + '/profile-changes/' + c.id}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {t('profileChanges.review')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function side(s: ProfileSnapshot, key: string) {
  return show(key, s.profile[key]);
}

/** One change: what patients see now next to what they would see, and the two decisions. */
export function ProfileChangeDetail({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'profile-change', id],
    queryFn: () => getProfileChange(id),
    retry: false,
  });
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();

  const decide = useMutation({
    mutationFn: (input: { decision: 'approve' | 'reject'; note?: string }) =>
      decideProfileChange(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileChangesKey });
      queryClient.removeQueries({ queryKey: ['admin', 'profile-change', id] });
      router.push(basePath + '/profile-changes');
    },
  });

  const back = (
    <Link
      href={basePath + '/profile-changes'}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('profileChanges.back')}
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
          {t('profileChanges.notFound')}
        </p>
      </>
    );
  }

  const c = q.data;
  const photoDiffers = c.photoChanged && c.current.photoUrl !== c.proposed.photoUrl;

  function reject() {
    if (note.trim().length < NOTE_MIN_LENGTH) {
      setNoteError(t('profileChanges.noteShort'));
      return;
    }
    setNoteError(undefined);
    decide.mutate({ decision: 'reject', note: note.trim() });
  }

  return (
    <>
      {back}
      <PageHeader
        title={c.name}
        description={`${c.applicant.name} · ${c.applicant.email ?? c.applicant.phone ?? ''} · ${formatWhen(c.submittedAt)}`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={decide.isPending && decide.variables?.decision === 'approve'}
          disabled={decide.isPending}
          onClick={() => decide.mutate({ decision: 'approve' })}
        >
          {t('profileChanges.approve')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={decide.isPending}
          onClick={() => setRejecting(true)}
        >
          {t('profileChanges.reject')}
        </Button>
      </div>
      {decide.isError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {t(authErrorKey(decide.error))}
        </p>
      )}

      {rejecting && (
        <Panel title={t('profileChanges.rejectTitle')} className="mb-4">
          <div className="space-y-3">
            <Field
              label={t('profileChanges.noteLabel')}
              hint={t('profileChanges.noteHint')}
              error={noteError}
            >
              {({ id: fieldId, describedBy, invalid }) => (
                <Textarea
                  id={fieldId}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={decide.isPending && decide.variables?.decision === 'reject'}
                disabled={decide.isPending}
                onClick={reject}
              >
                {t('profileChanges.reject')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejecting(false)}>
                {t('profileChanges.cancel')}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-semibold" />
                <th className="px-4 py-2 font-semibold">{t('profileChanges.current')}</th>
                <th className="px-4 py-2 font-semibold">{t('profileChanges.proposed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {photoDiffers && (
                <tr className="bg-warning-bg/40">
                  <td className="px-4 py-3 font-medium text-ink">
                    {t('profileChanges.photoTitle')}
                  </td>
                  <td className="px-4 py-3">
                    <Avatar url={c.current.photoUrl} />
                  </td>
                  <td className="px-4 py-3">
                    <Avatar url={c.proposed.photoUrl} />
                  </td>
                </tr>
              )}
              {c.changedFields.map((k) => (
                <tr key={k} className="bg-warning-bg/40 align-top">
                  <td className="px-4 py-3 font-medium text-ink">{label(k)}</td>
                  <td className="whitespace-pre-line px-4 py-3 text-ink-muted">
                    {side(c.current, k)}
                  </td>
                  <td className="whitespace-pre-line px-4 py-3 font-semibold text-ink">
                    {side(c.proposed, k)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
