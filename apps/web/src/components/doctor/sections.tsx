'use client';

import type { Gender, SpecialtyKey } from '@doqto/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useT } from '@/i18n/provider';
import type { FormConfig } from '@/lib/contract-data';
import { emptyQualification, type DoctorForm, type FormErrors } from './form-model';

export interface SectionProps {
  form: DoctorForm;
  set: (patch: Partial<DoctorForm>) => void;
  errors: FormErrors;
}

const LANGUAGES = ['Hindi', 'English', 'Urdu', 'Punjabi', 'Bengali', 'Bhojpuri'];
const COUNCILS = [
  'National Medical Commission',
  'Uttar Pradesh Medical Council',
  'Uttarakhand Medical Council',
  'Bihar Medical Council',
  'Delhi Medical Council',
  'Madhya Pradesh Medical Council',
  'Rajasthan Medical Council',
  'Haryana Medical Council',
  'Punjab Medical Council',
  'Uttar Pradesh Board of Indian Medicine',
  'Uttar Pradesh Homoeopathic Medicine Board',
  'Dental Council of India',
];

function TextField({
  label,
  hint,
  error,
  ...props
}: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...props}
        />
      )}
    </Field>
  );
}

export function AboutSection({
  form,
  set,
  errors,
  withBio,
  warnOnName,
}: SectionProps & { withBio?: boolean; warnOnName?: boolean }) {
  const t = useT();
  const [other, setOther] = useState('');
  const genders: { value: Gender; label: string }[] = [
    { value: 'female', label: t('doctor.genderFemale') },
    { value: 'male', label: t('doctor.genderMale') },
    { value: 'other', label: t('doctor.genderOther') },
  ];
  const custom = form.languages.filter((l) => !LANGUAGES.includes(l));
  const toggleLanguage = (lang: string) =>
    set({
      languages: form.languages.includes(lang)
        ? form.languages.filter((l) => l !== lang)
        : [...form.languages, lang].slice(0, 8),
    });

  return (
    <div className="space-y-5">
      <TextField
        label={t('doctor.nameLabel')}
        placeholder={t('doctor.namePlaceholder')}
        autoComplete="name"
        maxLength={80}
        value={form.name}
        error={errors.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      {warnOnName && (
        <p className="-mt-3 rounded-md bg-info-bg px-3 py-2 text-sm text-info">
          {t('doctor.nameChangeWarning')}
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t('doctor.genderLabel')}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {genders.map((g) => (
            <Chip
              key={g.value}
              kind="radio"
              selected={form.gender === g.value}
              onClick={() => set({ gender: form.gender === g.value ? null : g.value })}
            >
              {g.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t('doctor.languagesLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {[...LANGUAGES, ...custom].map((lang) => (
            <Chip
              key={lang}
              selected={form.languages.includes(lang)}
              onClick={() => toggleLanguage(lang)}
            >
              {lang}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            aria-label={t('doctor.languageOther')}
            placeholder={t('doctor.languageOther')}
            value={other}
            maxLength={30}
            onChange={(e) => setOther(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={other.trim().length < 2}
            onClick={() => {
              if (!form.languages.includes(other.trim())) toggleLanguage(other.trim());
              setOther('');
            }}
          >
            {t('form.add')}
          </Button>
        </div>
      </fieldset>
      <TextField
        label={t('doctor.experienceLabel')}
        inputMode="numeric"
        className="max-w-32"
        value={form.experienceYears}
        error={errors.experienceYears}
        onChange={(e) => set({ experienceYears: e.target.value.replace(/\D/g, '').slice(0, 2) })}
      />
      {withBio && (
        <Field label={t('doctor.bioLabel')} error={errors.bio}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              maxLength={1000}
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value })}
            />
          )}
        </Field>
      )}
    </div>
  );
}

export function QualificationsSection({ form, set, errors }: SectionProps) {
  const t = useT();
  const update = (i: number, patch: Partial<DoctorForm['qualifications'][number]>) =>
    set({ qualifications: form.qualifications.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  return (
    <div className="space-y-4">
      {form.qualifications.map((q, i) => (
        <div key={i} className="space-y-3 rounded-md border border-line p-3">
          <TextField
            label={t('doctor.degreeLabel')}
            placeholder={t('doctor.degreePlaceholder')}
            maxLength={80}
            value={q.degree}
            error={errors[`qualifications.${i}.degree`]}
            onChange={(e) => update(i, { degree: e.target.value })}
          />
          <TextField
            label={`${t('doctor.instituteLabel')} (${t('form.optional')})`}
            maxLength={160}
            value={q.institute}
            onChange={(e) => update(i, { institute: e.target.value })}
          />
          <div className="flex items-end justify-between gap-3">
            <TextField
              label={`${t('doctor.yearLabel')} (${t('form.optional')})`}
              inputMode="numeric"
              className="max-w-32"
              value={q.year}
              error={errors[`qualifications.${i}.year`]}
              onChange={(e) => update(i, { year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
            {form.qualifications.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  set({ qualifications: form.qualifications.filter((_, j) => j !== i) })
                }
              >
                <Trash2 className="size-4" aria-hidden />
                {t('form.remove')}
              </Button>
            )}
          </div>
        </div>
      ))}
      {form.qualifications.length < 10 && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => set({ qualifications: [...form.qualifications, emptyQualification()] })}
        >
          <Plus className="size-5" aria-hidden />
          {t('doctor.addQualification')}
        </Button>
      )}
    </div>
  );
}

export function SpecialtiesSection({
  form,
  set,
  errors,
  config,
}: SectionProps & { config: Pick<FormConfig, 'specialties' | 'maxSpecialties'> }) {
  const t = useT();
  const toggle = (key: SpecialtyKey) => {
    if (form.specialties.includes(key))
      set({ specialties: form.specialties.filter((s) => s !== key) });
    else if (form.specialties.length < config.maxSpecialties)
      set({ specialties: [...form.specialties, key] });
  };
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-ink-muted">
        {t('doctor.specialtiesHint', { max: config.maxSpecialties })}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {config.specialties.map((s) => (
          <Chip
            key={s.key}
            selected={form.specialties.includes(s.key as SpecialtyKey)}
            disabled={
              !form.specialties.includes(s.key as SpecialtyKey) &&
              form.specialties.length >= config.maxSpecialties
            }
            onClick={() => toggle(s.key as SpecialtyKey)}
          >
            {s.label}
          </Chip>
        ))}
      </div>
      {errors.specialties && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {errors.specialties}
        </p>
      )}
    </fieldset>
  );
}

export function RegistrationSection({
  form,
  set,
  errors,
  warnOnChange,
}: SectionProps & { warnOnChange?: boolean }) {
  const t = useT();
  return (
    <div className="space-y-5">
      {warnOnChange && (
        <p className="rounded-md bg-info-bg px-3 py-2 text-sm text-info">
          {t('doctor.registrationChangeWarning')}
        </p>
      )}
      <TextField
        label={t('doctor.councilLabel')}
        hint={t('doctor.councilHint')}
        list="doqto-councils"
        maxLength={120}
        value={form.council}
        error={errors.council}
        onChange={(e) => set({ council: e.target.value })}
      />
      <datalist id="doqto-councils">
        {COUNCILS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <TextField
        label={t('doctor.regNumberLabel')}
        autoCapitalize="characters"
        maxLength={40}
        value={form.regNumber}
        error={errors.regNumber}
        onChange={(e) => set({ regNumber: e.target.value })}
      />
      <TextField
        label={t('doctor.regYearLabel')}
        inputMode="numeric"
        className="max-w-32"
        value={form.regYear}
        error={errors.regYear}
        onChange={(e) => set({ regYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
      />
    </div>
  );
}

export function FeesSection({
  form,
  set,
  errors,
  config,
}: SectionProps & { config: Pick<FormConfig, 'bookingFeeMin' | 'bookingFeeMax'> }) {
  const t = useT();
  const min = config.bookingFeeMin / 100;
  const max = config.bookingFeeMax / 100;
  const presets = Array.from(new Set([min, Math.round((min + max) / 2), max]));
  return (
    <div className="space-y-5">
      <TextField
        label={`${t('doctor.consultFeeLabel')} (${t('form.optional')})`}
        hint={t('doctor.consultFeeHint')}
        inputMode="decimal"
        className="max-w-40"
        value={form.consultFee}
        error={errors.consultFee}
        onChange={(e) => set({ consultFee: e.target.value.replace(/[^\d.]/g, '').slice(0, 8) })}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">{t('doctor.bookingFeeLabel')}</legend>
        <p className="mb-3 text-xs text-ink-muted">{t('doctor.bookingFeeHint', { min, max })}</p>
        <div role="radiogroup" className="flex gap-2">
          {presets.map((p) => (
            <Chip
              key={p}
              kind="radio"
              className="min-w-16 justify-center"
              selected={form.bookingFee === String(p)}
              onClick={() => set({ bookingFee: String(p) })}
            >
              ₹{p}
            </Chip>
          ))}
        </div>
        {errors.bookingFee && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {errors.bookingFee}
          </p>
        )}
      </fieldset>
    </div>
  );
}
