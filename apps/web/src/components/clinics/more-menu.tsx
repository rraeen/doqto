'use client';

import {
  Building2,
  ChevronRight,
  ExternalLink,
  Home,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/shell/page';
import { useT } from '@/i18n/provider';
import { useDoctorProfile } from '@/lib/doctor';

function Row({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-4 hover:bg-canvas"
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        <Icon className="size-5 text-brand-600" aria-hidden />
        <span className="flex-1 font-medium">{label}</span>
        {external ? (
          <ExternalLink className="size-4 text-ink-muted" aria-hidden />
        ) : (
          <ChevronRight className="size-5 text-ink-muted" aria-hidden />
        )}
      </Link>
    </li>
  );
}

/** `/clinic/more`: links to the doctor's own setup pages and back to the patient app. */
export function MoreMenu() {
  const t = useT();
  const doctor = useDoctorProfile();
  const d = doctor.data;
  return (
    <>
      <PageTitle>{t('nav.more')}</PageTitle>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {d && <Row href="/clinic/profile" icon={UserRound} label={t('doctor.editProfile')} />}
        <Row href="/clinic/clinics" icon={Building2} label={t('doctor.manageClinics')} />
        {d?.isListed && (
          <Row href={`/d/${d.slug}`} icon={ExternalLink} label={t('doctor.viewPage')} external />
        )}
        <Row href="/profile" icon={Home} label={t('nav.profile')} />
      </ul>
    </>
  );
}
