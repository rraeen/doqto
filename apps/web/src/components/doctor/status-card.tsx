'use client';

import type { DoctorPrivateProfile } from '@doqto/shared';
import { CheckCircle2, Circle, Clock, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useT } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/translate';

const MISSING_LINK: Record<DoctorPrivateProfile['missing'][number], string> = {
  registration_document: '/clinic/profile#registration',
  clinic: '/clinic/clinics/new',
  specialties: '/clinic/profile#specialties',
  qualifications: '/clinic/profile#qualifications',
  booking_fee: '/clinic/profile#fees',
};

/** Verification status, rejection note and the "to go live" checklist (FE-05). */
export function DoctorStatusCard({ profile }: { profile: DoctorPrivateProfile }) {
  const t = useT();
  const { status, notes } = profile.verification;
  const toneClass =
    status === 'verified' ? 'text-success' : status === 'rejected' ? 'text-danger' : 'text-warning';
  const Icon = status === 'verified' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock;
  const title = {
    pending: t('doctor.statusPending'),
    verified: t('doctor.statusVerified'),
    rejected: t('doctor.statusRejected'),
  }[status];
  const body = {
    pending: t('doctor.statusPendingBody'),
    verified: t('doctor.statusVerifiedBody'),
    rejected: t('doctor.statusRejectedBody'),
  }[status];

  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-6 shrink-0 ${toneClass}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Badge tone={profile.isListed ? 'success' : 'neutral'}>
              {profile.isListed ? t('doctor.listed') : t('doctor.notListed')}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{body}</p>
          {status === 'rejected' && notes && (
            <p className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
              {t('doctor.rejectionNote', { note: notes })}
            </p>
          )}
        </div>
      </div>

      {profile.missing.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t('doctor.checklistTitle')}</h3>
          <ul className="space-y-1">
            {profile.missing.map((m) => (
              <li key={m}>
                <Link
                  href={MISSING_LINK[m]}
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-brand-700 hover:bg-canvas"
                >
                  <Circle className="size-4 text-ink-muted" aria-hidden />
                  {t(`doctor.missing_${m}` as MessageKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.isListed && (
        <Link
          href={`/d/${profile.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700"
        >
          {t('doctor.viewPage')}
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      )}
    </Card>
  );
}
