'use client';

import { mediaSrc } from '@/lib/media';
import type { DoctorPrivateProfile } from '@doqto/shared';
import { FileCheck2, FileWarning, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileButton } from '@/components/ui/file-button';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { doctorApi } from '@/lib/api/lazy';
import { isApiError } from '@/lib/api/errors';
import { authErrorMessage } from '@/lib/api/messages';
import type { FormConfig } from '@/lib/contract-data';
import { useSetDoctorProfile } from '@/lib/doctor';
import {
  comparableName,
  errorsFromIssues,
  formFromProfile,
  toProfilePatch,
  validateAll,
  type DoctorForm,
  type FormErrors,
} from './form-model';
import {
  AboutSection,
  FeesSection,
  QualificationsSection,
  RegistrationSection,
  SpecialtiesSection,
} from './sections';
import { DoctorStatusCard } from './status-card';

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

/** Doctor profile page: status, photo, certificate and every editable field, saved as one PATCH. */
export function ProfileEditor({
  profile,
  config,
}: {
  profile: DoctorPrivateProfile;
  config: FormConfig;
}) {
  const t = useT();
  const setProfile = useSetDoctorProfile();
  const [form, setForm] = useState<DoctorForm>(() => formFromProfile(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'photo' | 'doc' | null>(null);
  const set = (patch: Partial<DoctorForm>) => setForm((f) => ({ ...f, ...patch }));

  const patch = toProfilePatch(form, profile);
  const verified = profile.verification.status === 'verified';
  const registrationChanged = Boolean(patch?.registration);
  const renamed =
    verified &&
    patch?.name !== undefined &&
    comparableName(patch.name) !== comparableName(profile.name);
  const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

  const save = async () => {
    const e = validateAll(
      ['about', 'qualifications', 'specialties', 'registration', 'fees'],
      form,
      config,
      t,
    );
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error(t('form.checkFields'));
      return;
    }
    if (!patch) {
      toast(t('form.noChanges'));
      return;
    }
    setSaving(true);
    try {
      const next = await doctorApi.updateDoctorProfile(patch);
      setProfile(next);
      setForm(formFromProfile(next));
      toast.success(t('common.saved'));
    } catch (err) {
      if (isApiError(err, 'VALIDATION_FAILED'))
        setErrors(errorsFromIssues(err.details.issues, t('form.checkFields')));
      toast.error(authErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: 'photo' | 'doc', file: File) => {
    setUploading(kind);
    try {
      if (kind === 'photo') setProfile(await doctorApi.uploadDoctorPhoto(file));
      else {
        await doctorApi.uploadRegistrationDocument(file);
        const fresh = await doctorApi.getDoctorProfile();
        if (fresh) setProfile(fresh);
      }
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(authErrorMessage(err, t));
    } finally {
      setUploading(null);
    }
  };

  const reject = (bytes: number) => (r: 'type' | 'size') =>
    toast.error(r === 'size' ? t('form.fileTooBig', { mb: mb(bytes) }) : t('form.fileWrongType'));

  return (
    <div className="space-y-5">
      <DoctorStatusCard profile={profile} />

      <Block id="photo" title={t('doctor.photoLabel')}>
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            // Doctor's own preview; the public page uses next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSrc(profile.photoUrl)}
              alt=""
              className="size-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-canvas text-ink-muted">
              <UserRound className="size-10" aria-hidden />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">
              {t('doctor.photoHint', { mb: mb(config.photoMaxBytes) })}
            </p>
            <FileButton
              accept={config.photoTypes}
              maxBytes={config.photoMaxBytes}
              loading={uploading === 'photo'}
              onSelect={(f) => void upload('photo', f)}
              onReject={reject(config.photoMaxBytes)}
            >
              {profile.photoUrl ? t('form.replace') : t('form.upload')}
            </FileButton>
          </div>
        </div>
      </Block>

      <Block id="about" title={t('doctor.stepAbout')}>
        <AboutSection form={form} set={set} errors={errors} withBio warnOnName={renamed} />
      </Block>
      <Block id="qualifications" title={t('doctor.stepQualifications')}>
        <QualificationsSection form={form} set={set} errors={errors} />
      </Block>
      <Block id="specialties" title={t('doctor.stepSpecialties')}>
        <SpecialtiesSection form={form} set={set} errors={errors} config={config} />
      </Block>
      <Block id="registration" title={t('doctor.stepRegistration')}>
        <RegistrationSection
          form={form}
          set={set}
          errors={errors}
          warnOnChange={registrationChanged}
        />
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium">{t('doctor.documentLabel')}</p>
          <p
            className={`flex items-center gap-2 text-sm ${profile.registration.documentUploaded ? 'text-success' : 'text-warning'}`}
          >
            {profile.registration.documentUploaded ? (
              <FileCheck2 className="size-4" aria-hidden />
            ) : (
              <FileWarning className="size-4" aria-hidden />
            )}
            {profile.registration.documentUploaded
              ? t('doctor.documentUploaded')
              : t('doctor.documentMissing')}
          </p>
          <p className="text-xs text-ink-muted">
            {t('doctor.documentHint', { mb: mb(config.docMaxBytes) })}
            {verified && ` ${t('doctor.documentChangeWarning')}`}
          </p>
          <FileButton
            accept={config.docTypes}
            maxBytes={config.docMaxBytes}
            loading={uploading === 'doc'}
            onSelect={(f) => void upload('doc', f)}
            onReject={reject(config.docMaxBytes)}
          >
            {profile.registration.documentUploaded ? t('form.replace') : t('form.upload')}
          </FileButton>
        </div>
      </Block>
      <Block id="fees" title={t('doctor.stepFees')}>
        <FeesSection form={form} set={set} errors={errors} config={config} />
      </Block>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 rounded-2xl bg-surface p-3 shadow-md md:bottom-4">
        <Button size="lg" loading={saving} disabled={!patch} onClick={() => void save()}>
          {t('form.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
