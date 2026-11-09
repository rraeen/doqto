'use client';

import { mediaSrc } from '@/lib/media';
import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { UNIT_FORMS, checkUnitProfile } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, UserRound } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import {
  authErrorKey,
  getMyProfile,
  profileKey,
  saveMyProfile,
  uploadProfilePhoto,
  withdrawProfileChange,
} from '@/lib/auth';
import { PHOTO_TYPES, shrinkPhoto } from '@/lib/image';
import { FormFieldInput, fromProfile, toProfile, type Values } from '../apply/application-form';
import { useClinicUnit } from './schedule-editor';

/**
 * The doctor's own profile: the photo and the details patients see on the doctor page and in
 * search. Everything saved here is kept as a change that waits for the Doqto team; patients keep
 * seeing the approved profile until it is approved, then the new one replaces it.
 */
export function ProfileScreen() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { unitId, loading } = useClinicUnit();
  const picker = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState<Values>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  const q = useQuery({
    queryKey: profileKey(unitId ?? ''),
    queryFn: () => getMyProfile(unitId!),
    enabled: Boolean(unitId),
  });

  const done = async (next: Awaited<ReturnType<typeof getMyProfile>>, text: string) => {
    queryClient.setQueryData(profileKey(unitId!), next);
    setEdits(undefined);
    setErrors({});
    setMessage({ ok: true, text });
  };
  const fail = (err: unknown) => {
    const issues = isApiError(err) && Array.isArray(err.details.issues) ? err.details.issues : [];
    if (issues.length > 0 && !(issues as { path: string }[]).some((i) => i.path === 'profile')) {
      setErrors(
        Object.fromEntries((issues as { path: string }[]).map((i) => [i.path, t('apply.invalid')])),
      );
      setMessage({ ok: false, text: t('myProfile.fixErrors') });
    } else if (issues.length > 0) {
      setMessage({ ok: false, text: t('myProfile.nothingChanged') });
    } else {
      setMessage({ ok: false, text: t(authErrorKey(err)) });
    }
  };

  const save = useMutation({
    mutationFn: (profile: Record<string, unknown>) => saveMyProfile(unitId!, profile),
    onSuccess: (next) => done(next, t('myProfile.saved')),
    onError: fail,
  });
  const photo = useMutation({
    mutationFn: async (file: File) => uploadProfilePhoto(unitId!, await shrinkPhoto(file)),
    onSuccess: (next) => {
      queryClient.setQueryData(profileKey(unitId!), next);
      setMessage({ ok: true, text: t('myProfile.photoSent') });
    },
    onError: fail,
  });
  const withdraw = useMutation({
    mutationFn: () => withdrawProfileChange(unitId!),
    onSuccess: (next) => done(next, t('myProfile.withdrawn')),
    onError: fail,
  });

  const header = (
    <PageHeader title={t('areas.profile.title')} description={t('areas.profile.description')} />
  );
  if (loading || (unitId && q.isPending)) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-ink-muted">
          {t('common.loading')}
        </p>
      </>
    );
  }
  if (!unitId) {
    return (
      <>
        {header}
        <Panel>
          <p className="text-sm text-ink-muted">{t('myProfile.noUnit')}</p>
        </Panel>
      </>
    );
  }
  if (q.isError || !q.data) {
    return (
      <>
        {header}
        <p role="alert" className="text-sm text-danger">
          {t('myProfile.loadFailed')}
        </p>
      </>
    );
  }

  const { current, pending, listed } = q.data;
  const base = fromProfile('clinic', pending?.profile ?? current.profile);
  const values = edits ?? base;
  const photoUrl = pending?.photoUrl ?? current.photoUrl;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const profile = toProfile('clinic', values);
    const res = checkUnitProfile('clinic', profile);
    if (!res.ok) {
      setErrors(
        Object.fromEntries(
          res.issues.map((i) => [
            i.path,
            profile[i.path] === undefined || profile[i.path] === ''
              ? t('apply.required')
              : t('apply.invalid'),
          ]),
        ),
      );
      setMessage({ ok: false, text: t('myProfile.fixErrors') });
      return;
    }
    setErrors({});
    setMessage(undefined);
    save.mutate(profile);
  }

  function pick(file: File | undefined) {
    if (picker.current) picker.current.value = '';
    if (!file) return;
    if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setMessage({ ok: false, text: t('myProfile.photoBad') });
      return;
    }
    setMessage(undefined);
    photo.mutate(file);
  }

  const fieldNames = (pending?.changedFields ?? [])
    .map((k) => t(('form.clinic.' + k) as Parameters<typeof t>[0]))
    .concat(pending?.photoChanged ? [t('myProfile.newPhoto')] : [])
    .join(', ');

  return (
    <>
      {header}
      <p className="mb-4 text-sm text-ink-muted">
        {listed ? t('myProfile.liveYes') : t('myProfile.liveNo')}
      </p>

      {pending?.status === 'pending' && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-warning-bg px-4 py-3"
        >
          <div className="min-w-0 text-sm text-ink">
            <p className="font-semibold">{t('myProfile.pendingTitle')}</p>
            <p>{t('myProfile.pendingBody')}</p>
            {fieldNames && (
              <p className="mt-1 text-ink-muted">
                {t('myProfile.pendingFields', { fields: fieldNames })}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            {t('myProfile.withdraw')}
          </Button>
        </div>
      )}
      {pending?.status === 'rejected' && (
        <div role="note" className="mb-4 rounded-sm bg-warning-bg px-4 py-3 text-sm text-ink">
          <p className="font-semibold">{t('myProfile.rejectedTitle')}</p>
          <p>{t('myProfile.rejectedBody')}</p>
          {pending.reviewNote && (
            <p className="mt-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-warning">
                {t('panel.noteFromDoqto')}
              </span>
              {pending.reviewNote}
            </p>
          )}
        </div>
      )}
      {message && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={message.ok ? 'mb-4 text-sm text-brand-700' : 'mb-4 text-sm text-danger'}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Panel
          title={t('myProfile.photoTitle')}
          description={t('myProfile.photoHint')}
          className="self-start"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-40 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-ink-muted">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaSrc(photoUrl)} alt="" className="size-full object-cover" />
              ) : (
                <UserRound className="size-16" aria-hidden />
              )}
            </div>
            {!photoUrl && <p className="text-sm text-ink-muted">{t('myProfile.noPhoto')}</p>}
            {pending?.photoChanged && (
              <p className="text-center text-xs text-warning">{t('myProfile.photoWaiting')}</p>
            )}
            <input
              ref={picker}
              type="file"
              accept={PHOTO_TYPES.join(',')}
              className="hidden"
              data-testid="photo-input"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              loading={photo.isPending}
              onClick={() => picker.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              {photoUrl ? t('myProfile.changePhoto') : t('myProfile.choosePhoto')}
            </Button>
          </div>
        </Panel>

        <Panel title={t('myProfile.detailsTitle')} description={t('myProfile.detailsHint')}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {UNIT_FORMS.clinic.map((f) => (
                <FormFieldInput
                  key={f.key}
                  kind="clinic"
                  field={f}
                  locale={locale}
                  value={values[f.key]}
                  error={errors[f.key]}
                  onChange={(v) => {
                    setEdits({ ...values, [f.key]: v });
                    setMessage(undefined);
                    setErrors(({ [f.key]: _gone, ...rest }) => rest);
                  }}
                />
              ))}
            </div>
            <Button type="submit" loading={save.isPending}>
              {t('myProfile.save')}
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
