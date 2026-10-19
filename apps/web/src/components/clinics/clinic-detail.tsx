'use client';

import type { ClinicPrivate, ClinicStaffMember } from '@doqto/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, Plus, Trash2, UserRound } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FileButton } from '@/components/ui/file-button';
import { Field, Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { isApiError } from '@/lib/api/errors';
import { clinicsApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';
import type { FormConfig } from '@/lib/contract-data';
import { clinicKey, StickySave, useStoreClinic } from './clinic-data';
import {
  ClinicDetailsForm,
  clinicFormFrom,
  toUpdateRequest,
  validateClinic,
  type ClinicErrors,
  type ClinicFormValues,
} from './clinic-form';

// The dialog code loads when a confirmation first opens, not with the page.
const ConfirmSheet = dynamic(
  () => import('@/components/ui/confirm-sheet').then((m) => m.ConfirmSheet),
  {
    ssr: false,
  },
);

export function ClinicDetailPage({ id, config }: { id: string; config: FormConfig }) {
  const t = useT();
  const gate = useSignedIn(`/clinic/clinics/${id}`);
  const clinic = useQuery({
    queryKey: clinicKey(id),
    queryFn: ({ signal }) => clinicsApi.getClinic(id, signal),
    enabled: Boolean(gate.me),
    retry: (n, err) => !isApiError(err, 'NOT_FOUND') && !isApiError(err, 'FORBIDDEN') && n < 2,
  });
  if (!gate.me) return gate.node;
  if (clinic.isPending) return <Loading />;
  if (clinic.isError) {
    const missing = isApiError(clinic.error, 'NOT_FOUND') || isApiError(clinic.error, 'FORBIDDEN');
    return (
      <EmptyState
        icon={Building2}
        title={missing ? t('empty.notFound') : t('common.somethingWrong')}
        action={
          <Link href="/clinic/clinics" className={buttonVariants({ variant: 'outline' })}>
            {t('clinicSetup.listTitle')}
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-5">
      <PageTitle>{clinic.data.name}</PageTitle>
      {/* Remount on server-side changes so the form restarts from saved values. */}
      <ClinicDetailsEditor key={JSON.stringify(clinicFormFrom(clinic.data))} clinic={clinic.data} />
      <ClinicPhotos clinic={clinic.data} config={config} />
      {clinic.data.canManage && <ClinicStaff clinic={clinic.data} />}
    </div>
  );
}

function ClinicDetailsEditor({ clinic }: { clinic: ClinicPrivate }) {
  const t = useT();
  const store = useStoreClinic();
  const [form, setForm] = useState<ClinicFormValues>(() => clinicFormFrom(clinic));
  const [errors, setErrors] = useState<ClinicErrors>({});
  const save = useMutation({
    mutationFn: (patch: NonNullable<ReturnType<typeof toUpdateRequest>>) =>
      clinicsApi.updateClinic(clinic.id, patch),
    onSuccess: (c) => {
      store(c);
      toast.success(t('common.saved'));
    },
    onError: (err) => toast.error(authErrorMessage(err, t)),
  });
  const readOnly = !clinic.canManage;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validateClinic(form, t);
        setErrors(errs);
        if (Object.keys(errs).length) {
          toast.error(t('form.checkFields'));
          return;
        }
        const patch = toUpdateRequest(form, clinic);
        if (!patch) {
          toast(t('form.noChanges'));
          return;
        }
        save.mutate(patch);
      }}
    >
      {readOnly && (
        <p className="rounded-md bg-canvas px-3 py-2 text-sm text-ink-muted">
          {t('clinicSetup.readOnly')}
        </p>
      )}
      <ClinicDetailsForm value={form} onChange={setForm} errors={errors} disabled={readOnly} />
      {!readOnly && (
        <StickySave>
          <Button type="submit" size="lg" loading={save.isPending}>
            {t('form.saveChanges')}
          </Button>
        </StickySave>
      )}
    </form>
  );
}

function ClinicPhotos({ clinic, config }: { clinic: ClinicPrivate; config: FormConfig }) {
  const t = useT();
  const store = useStoreClinic();
  const [removing, setRemoving] = useState<number | null>(null);
  const add = useMutation({
    mutationFn: (file: File) => clinicsApi.addClinicPhoto(clinic.id, file),
    onSuccess: store,
    onError: (err) => toast.error(authErrorMessage(err, t)),
  });
  const remove = useMutation({
    mutationFn: (index: number) => clinicsApi.deleteClinicPhoto(clinic.id, index),
    onSuccess: (c) => {
      store(c);
      setRemoving(null);
    },
    onError: (err) => toast.error(authErrorMessage(err, t)),
  });
  const full = clinic.photoUrls.length >= config.clinicPhotosMax;
  const mb = Math.round(config.photoMaxBytes / 1024 / 1024);
  if (!clinic.canManage && clinic.photoUrls.length === 0) return null;
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{t('clinicSetup.photosTitle')}</h2>
        <p className="text-xs text-ink-muted">
          {t('clinicSetup.photosHint', { max: config.clinicPhotosMax })}
        </p>
      </div>
      {clinic.photoUrls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {clinic.photoUrls.map((url, i) => (
            <li key={url} className="relative aspect-square overflow-hidden rounded-md bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element -- owner-only view; next/image would need every R2 host configured */}
              <img src={url} alt="" className="size-full object-cover" loading="lazy" />
              {clinic.canManage && (
                <button
                  type="button"
                  aria-label={t('form.remove')}
                  className="absolute right-1 top-1 rounded-full bg-ink/70 p-1.5 text-white"
                  onClick={() => setRemoving(i)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {clinic.canManage &&
        (full ? (
          <p className="text-sm text-ink-muted">{t('clinicSetup.photoLimit')}</p>
        ) : (
          <FileButton
            accept={config.photoTypes}
            maxBytes={config.photoMaxBytes}
            loading={add.isPending}
            onSelect={(f) => add.mutate(f)}
            onReject={(r) =>
              toast.error(r === 'size' ? t('form.fileTooBig', { mb }) : t('form.fileWrongType'))
            }
          >
            {t('clinicSetup.addPhoto')}
          </FileButton>
        ))}
      {removing !== null && (
        <ConfirmSheet
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={t('clinicSetup.removePhotoConfirm')}
          confirmLabel={t('form.remove')}
          cancelLabel={t('common.cancel')}
          danger
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
        />
      )}
    </Card>
  );
}

function ClinicStaff({ clinic }: { clinic: ClinicPrivate }) {
  const t = useT();
  const store = useStoreClinic();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [phoneKey, setPhoneKey] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [removing, setRemoving] = useState<ClinicStaffMember | null>(null);
  const add = useMutation({
    mutationFn: () =>
      clinicsApi.addStaff(clinic.id, {
        phone: phone!,
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (c) => {
      store(c);
      toast.success(t('clinicSetup.staffAdded'));
      setName('');
      setPhone(null);
      setDigits('');
      setPhoneKey((k) => k + 1);
    },
    onError: (err) => {
      if (isApiError(err, 'CONFLICT')) setError(t('clinicSetup.alreadyStaff'));
      else toast.error(authErrorMessage(err, t));
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => clinicsApi.removeStaff(clinic.id, userId),
    onSuccess: (c) => {
      store(c);
      setRemoving(null);
    },
    onError: (err) => toast.error(authErrorMessage(err, t)),
  });
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">{t('clinicSetup.staffTitle')}</h2>
        <p className="text-xs text-ink-muted">{t('clinicSetup.staffHint')}</p>
      </div>
      {clinic.staff.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('clinicSetup.noStaff')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {clinic.staff.map((s) => (
            <li key={s.userId} className="flex items-center gap-3 py-2">
              <UserRound className="size-5 text-ink-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name ?? s.phone}</p>
                {s.name && <p className="text-sm text-ink-muted">{s.phone}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(s)}>
                {t('clinicSetup.removeStaff')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        noValidate
        className="space-y-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!phone) {
            setError(digits ? t('form.invalidPhone') : t('form.required'));
            return;
          }
          setError(undefined);
          add.mutate();
        }}
      >
        <Field label={`${t('clinicSetup.staffName')} (${t('form.optional')})`}>
          {({ id }) => (
            <Input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={t('clinicSetup.staffPhone')} error={error}>
          {({ id, describedBy, invalid }) => (
            <PhoneInput
              key={phoneKey}
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onValueChange={(p, d) => {
                setPhone(p);
                setDigits(d);
                setError(undefined);
              }}
            />
          )}
        </Field>
        <Button type="submit" variant="secondary" className="w-full" loading={add.isPending}>
          <Plus className="size-5" aria-hidden />
          {t('clinicSetup.addStaff')}
        </Button>
      </form>
      {removing !== null && (
        <ConfirmSheet
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={t('clinicSetup.removeStaffConfirm', {
            name: removing?.name ?? removing?.phone ?? '',
          })}
          confirmLabel={t('clinicSetup.removeStaff')}
          cancelLabel={t('common.cancel')}
          danger
          loading={remove.isPending}
          onConfirm={() => remove.mutate(removing.userId)}
        />
      )}
    </Card>
  );
}
