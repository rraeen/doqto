'use client';

import { Building2, Stethoscope, UserRound } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/shell/page';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';
import { useDoctorProfile } from '@/lib/doctor';
import { DoctorStatusCard } from './status-card';

/** `/clinic` home for a doctor: status and checklist, or the invitation to join. Staff see the console placeholder. */
export function ClinicHome() {
  const t = useT();
  const gate = useSignedIn('/clinic');
  const doctor = useDoctorProfile();
  if (!gate.me) return gate.node;
  if (doctor.isPending) return <Loading />;

  if (!doctor.data) {
    if (gate.me.roles.includes('clinic_staff')) {
      return (
        <>
          <PageTitle>{t('clinic.title')}</PageTitle>
          <EmptyState
            icon={Building2}
            title={t('empty.comingSoon')}
            description={t('clinic.placeholder')}
          />
        </>
      );
    }
    return (
      <Card className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Stethoscope className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">{t('doctor.joinTitle')}</h1>
        <p className="text-ink-muted">{t('doctor.joinBody')}</p>
        <Link href="/clinic/onboarding" className={buttonVariants({ size: 'lg' })}>
          {t('doctor.joinCta')}
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageTitle>{doctor.data.name}</PageTitle>
      <DoctorStatusCard profile={doctor.data} />
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/clinic/profile"
          className={buttonVariants({ variant: 'outline', className: 'h-20 flex-col' })}
        >
          <UserRound className="size-6" aria-hidden />
          {t('doctor.editProfile')}
        </Link>
        <Link
          href="/clinic/clinics"
          className={buttonVariants({ variant: 'outline', className: 'h-20 flex-col' })}
        >
          <Building2 className="size-6" aria-hidden />
          {t('doctor.manageClinics')}
        </Link>
      </div>
    </div>
  );
}
