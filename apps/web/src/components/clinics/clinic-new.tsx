'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { clinicsApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';
import { useDoctorProfile } from '@/lib/doctor';
import { StickySave, useStoreClinic } from './clinic-data';
import {
  ClinicDetailsForm,
  clinicFormFrom,
  toCreateRequest,
  validateClinic,
  type ClinicErrors,
  type ClinicFormValues,
} from './clinic-form';

export function NewClinicPage() {
  const t = useT();
  const router = useRouter();
  const store = useStoreClinic();
  const gate = useSignedIn('/clinic/clinics/new');
  const doctor = useDoctorProfile();
  const [form, setForm] = useState<ClinicFormValues>(() => clinicFormFrom());
  const [errors, setErrors] = useState<ClinicErrors>({});
  const create = useMutation({
    mutationFn: () => clinicsApi.createClinic(toCreateRequest(form)),
    onSuccess: (c) => {
      store(c);
      toast.success(t('clinicSetup.created'));
      router.replace(`/clinic/clinics/${c.id}`);
    },
    onError: (err) => toast.error(authErrorMessage(err, t)),
  });
  if (!gate.me) return gate.node;
  if (doctor.isPending) return <Loading />;
  if (!doctor.data) {
    return (
      <EmptyState
        title={t('doctor.joinTitle')}
        description={t('doctor.joinBody')}
        action={
          <Link href="/clinic/onboarding" className={buttonVariants({ size: 'lg' })}>
            {t('doctor.joinCta')}
          </Link>
        }
      />
    );
  }
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const errs = validateClinic(form, t);
        setErrors(errs);
        if (Object.keys(errs).length) {
          toast.error(t('form.checkFields'));
          return;
        }
        create.mutate();
      }}
    >
      <PageTitle>{t('clinicSetup.newTitle')}</PageTitle>
      <ClinicDetailsForm value={form} onChange={setForm} errors={errors} />
      <StickySave>
        <Button type="submit" size="lg" loading={create.isPending}>
          {t('clinicSetup.save')}
        </Button>
      </StickySave>
    </form>
  );
}
