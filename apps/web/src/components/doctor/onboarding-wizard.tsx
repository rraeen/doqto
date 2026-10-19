'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileCheck2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileButton } from '@/components/ui/file-button';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { authApi, doctorApi } from '@/lib/api/lazy';
import { isApiError } from '@/lib/api/errors';
import { authErrorMessage } from '@/lib/api/messages';
import type { FormConfig } from '@/lib/contract-data';
import { doctorProfileKey } from '@/lib/doctor';
import { rupeesToPaise } from '@/lib/money';
import { meQueryKey, useMe } from '@/lib/session';
import {
  emptyDoctorForm,
  errorsFromIssues,
  toOnboardingRequest,
  validateSection,
  type DoctorForm,
  type FormErrors,
  type Section,
} from './form-model';
import {
  AboutSection,
  FeesSection,
  QualificationsSection,
  RegistrationSection,
  SpecialtiesSection,
} from './sections';

const STEPS: Section[] = ['about', 'qualifications', 'specialties', 'registration', 'fees'];
export const DRAFT_KEY = 'doqto_doctor_draft';

function loadDraft(): { form: DoctorForm; step: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { form: DoctorForm; step: number }) : null;
  } catch {
    return null;
  }
}

function saveDraft(form: DoctorForm, step: number) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
  } catch {
    // Private mode: the form still works, the draft just is not kept.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * FE-05 multi-step onboarding. Steps 1 to 4 are kept as a local draft; step 4 creates the
 * profile (`POST /doctor/onboarding`) and uploads the certificate; step 5 saves the fees.
 */
export function OnboardingWizard({
  config,
  onboarded,
  onFinishing,
}: {
  config: FormConfig;
  onboarded: boolean;
  /** Called before the last save, so the page does not mistake our own finish for a revisit. */
  onFinishing: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  // Rendered only on the client after the session loads, so reading the draft here is SSR-safe.
  const [initial] = useState(() => (onboarded ? null : loadDraft()));
  const [step, setStep] = useState(onboarded ? 4 : Math.min(initial?.step ?? 0, 3));
  const [form, setForm] = useState<DoctorForm>(
    () => initial?.form ?? emptyDoctorForm(me.data?.name ?? ''),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [doc, setDoc] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!onboarded && step < 4) saveDraft(form, step);
  }, [form, step, onboarded]);

  const section = STEPS[step] ?? 'about';
  const set = (patch: Partial<DoctorForm>) => setForm((f) => ({ ...f, ...patch }));
  const titles: Record<Section, string> = {
    about: t('doctor.stepAbout'),
    qualifications: t('doctor.stepQualifications'),
    specialties: t('doctor.stepSpecialties'),
    registration: t('doctor.stepRegistration'),
    fees: t('doctor.stepFees'),
  };

  const fail = (err: unknown) => {
    if (isApiError(err, 'VALIDATION_FAILED')) {
      setErrors(errorsFromIssues(err.details.issues, t('form.checkFields')));
      toast.error(t('form.checkFields'));
    } else {
      toast.error(authErrorMessage(err, t));
    }
  };

  const submitRegistration = async () => {
    setBusy(true);
    try {
      if (!onboarded) {
        const profile = await doctorApi.onboardDoctor(toOnboardingRequest(form));
        qc.setQueryData(doctorProfileKey, profile);
        clearDraft();
        // The new role reaches the access token only after a refresh (CONTRACT.md).
        await authApi.refreshNow();
        void qc.invalidateQueries({ queryKey: meQueryKey });
      }
      if (doc) {
        await doctorApi.uploadRegistrationDocument(doc);
        void qc.invalidateQueries({ queryKey: doctorProfileKey });
      }
      setStep(4);
    } catch (err) {
      if (isApiError(err, 'CONFLICT')) setStep(4);
      else fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submitFees = async () => {
    setBusy(true);
    onFinishing();
    try {
      const profile = await doctorApi.updateDoctorProfile({
        consultFee: rupeesToPaise(form.consultFee),
        bookingFee: rupeesToPaise(form.bookingFee),
      });
      qc.setQueryData(doctorProfileKey, profile);
      toast.success(t('doctor.submitted'));
      router.replace('/clinic');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const e = validateSection(section, form, config, t);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (section === 'registration') void submitRegistration();
    else if (section === 'fees') void submitFees();
    else setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  const docMb = Math.round(config.docMaxBytes / (1024 * 1024));

  return (
    <div className="space-y-5">
      <PageTitle description={t('doctor.stepOf', { step: step + 1, total: STEPS.length })}>
        {t('doctor.onboardingTitle')}
      </PageTitle>
      <ol className="flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-line'}`}
          />
        ))}
      </ol>

      <Card className="space-y-5">
        <h2 className="text-lg font-semibold">{titles[section]}</h2>
        {section === 'about' && <AboutSection form={form} set={set} errors={errors} />}
        {section === 'qualifications' && (
          <QualificationsSection form={form} set={set} errors={errors} />
        )}
        {section === 'specialties' && (
          <SpecialtiesSection form={form} set={set} errors={errors} config={config} />
        )}
        {section === 'registration' && (
          <>
            <RegistrationSection form={form} set={set} errors={errors} />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('doctor.documentLabel')} ({t('form.optional')})
              </p>
              <p className="text-xs text-ink-muted">{t('doctor.documentHint', { mb: docMb })}</p>
              {doc && (
                <p className="flex items-center gap-2 text-sm text-success">
                  <FileCheck2 className="size-4" aria-hidden />
                  {doc.name}
                </p>
              )}
              <FileButton
                accept={config.docTypes}
                maxBytes={config.docMaxBytes}
                onSelect={setDoc}
                onReject={(r) =>
                  toast.error(
                    r === 'size' ? t('form.fileTooBig', { mb: docMb }) : t('form.fileWrongType'),
                  )
                }
              >
                {doc ? t('form.replace') : t('form.upload')}
              </FileButton>
            </div>
          </>
        )}
        {section === 'fees' && (
          <FeesSection form={form} set={set} errors={errors} config={config} />
        )}
      </Card>

      {!onboarded && step < 4 && (
        <p className="text-center text-xs text-ink-muted">{t('doctor.draftSaved')}</p>
      )}

      <div className="flex gap-3">
        {step > 0 && step !== 4 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-auto"
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="size-5" aria-hidden />
            <span className="sr-only">{t('common.back')}</span>
          </Button>
        )}
        <Button type="button" size="lg" loading={busy} onClick={next}>
          {section === 'registration'
            ? t('doctor.submit')
            : section === 'fees'
              ? t('doctor.finish')
              : t('common.continue')}
        </Button>
      </div>
    </div>
  );
}
