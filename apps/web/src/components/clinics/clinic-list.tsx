'use client';

import { Building2, ChevronRight, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/shell/page';
import { Loading, useSignedIn } from '@/components/shell/signed-in';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';
import { useDoctorProfile } from '@/lib/doctor';
import { addressLine, useMyClinics } from './clinic-data';

export function ClinicListPage() {
  const t = useT();
  const gate = useSignedIn('/clinic/clinics');
  const doctor = useDoctorProfile();
  const clinics = useMyClinics(Boolean(gate.me));
  if (!gate.me) return gate.node;
  if (clinics.isPending || doctor.isPending) return <Loading />;
  if (clinics.isError) {
    return (
      <EmptyState
        title={t('common.somethingWrong')}
        action={
          <Button variant="outline" onClick={() => void clinics.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  const canAdd = Boolean(doctor.data);
  return (
    <div className="space-y-4">
      <PageTitle>{t('clinicSetup.listTitle')}</PageTitle>
      {clinics.data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('clinicSetup.noClinics')}
          description={t('clinicSetup.noClinicsBody')}
          action={
            canAdd && (
              <Link href="/clinic/clinics/new" className={buttonVariants({ size: 'lg' })}>
                <Plus className="size-5" aria-hidden />
                {t('clinicSetup.addClinic')}
              </Link>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {clinics.data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clinic/clinics/${c.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-canvas"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Building2 className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-sm text-ink-muted">{addressLine(c)}</p>
                    {!c.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                        <MapPin className="size-3.5" aria-hidden />
                        {t('clinicSetup.noPin')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-5 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          {canAdd && (
            <Link
              href="/clinic/clinics/new"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <Plus className="size-5" aria-hidden />
              {t('clinicSetup.addClinic')}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
