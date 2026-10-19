// No 'use client' and no hooks: rendered on the server for /d/<slug>, and by the mock-mode fallback.
import type { Clinic, DoctorProfile } from '@doqto/shared';
import {
  BadgeCheck,
  Languages,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Translate } from '@/i18n/translate';
import { formatRupees } from '@/lib/money';

export interface ProfileViewProps {
  profile: DoctorProfile;
  t: Translate;
  specialties: Record<string, string>;
  /** Hostname whose photos next/image may optimise (the public R2 bucket); others load as is. */
  photoHost: string | null;
}

export function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Display city: the primary clinic's address as typed, else the API's normalised city. */
export function displayCity(p: Pick<DoctorProfile, 'city' | 'clinics'>): string {
  return p.clinics[0]?.address.city ?? titleCase(p.city);
}

function canOptimise(url: string, host: string | null): boolean {
  try {
    return host !== null && new URL(url).hostname === host;
  } catch {
    return false;
  }
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function ClinicCard({ clinic, t }: { clinic: Clinic; t: Translate }) {
  const a = clinic.address;
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">{clinic.name}</h3>
        <p className="mt-1 flex gap-1.5 text-sm text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{[a.line1, a.area, a.city, a.pincode].filter(Boolean).join(', ')}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {clinic.mapsUrl && (
          <a
            href={clinic.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <Navigation className="size-4" aria-hidden />
            {t('doctorPage.directions')}
          </a>
        )}
        {clinic.phone && (
          <a
            href={`tel:${clinic.phone}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Phone className="size-4" aria-hidden />
            {t('doctorPage.call')}
          </a>
        )}
      </div>
    </Card>
  );
}

export function DoctorProfileView({ profile: p, t, specialties, photoHost }: ProfileViewProps) {
  const specialtyNames = p.specialties.map((s) => specialties[s] ?? s);
  const city = displayCity(p);
  return (
    <article className="space-y-6">
      <header className="flex gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-brand-50">
          {p.photoUrl ? (
            <Image
              src={p.photoUrl}
              alt={p.name}
              fill
              sizes="96px"
              priority
              className="object-cover"
              unoptimized={!canOptimise(p.photoUrl, photoHost)}
            />
          ) : (
            <UserRound className="absolute inset-0 m-auto size-12 text-brand-600" aria-hidden />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold leading-tight">{p.name}</h1>
          <p className="text-ink-muted">
            {specialtyNames.join(', ')} · {city}
          </p>
          {p.experienceYears !== null && p.experienceYears > 0 && (
            <p className="text-sm text-ink-muted">
              {t('doctorPage.experience', { years: p.experienceYears })}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {p.verificationStatus === 'verified' && (
              <Badge tone="success">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t('doctorPage.registrationVerified')}
              </Badge>
            )}
            {!p.ratingSummary || p.ratingSummary.count === 0 ? (
              <Badge tone="brand">
                <Sparkles className="size-3.5" aria-hidden />
                {t('doctorPage.newOnDoqto')}
              </Badge>
            ) : (
              <Badge tone="brand">
                {p.ratingSummary.recommendPct}% · {p.ratingSummary.count}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <Card className="flex items-center gap-3 bg-canvas">
        <Radio className="size-5 text-ink-muted" aria-hidden />
        <p className="text-sm text-ink-muted">{t('doctorPage.liveStatusSoon')}</p>
      </Card>

      {p.consultFee !== null && (
        <Card className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-medium">{t('doctorPage.consultFee')}</p>
            <p className="text-xs text-ink-muted">{t('doctorPage.consultFeeNote')}</p>
          </div>
          <p className="text-xl font-bold">{formatRupees(p.consultFee)}</p>
        </Card>
      )}

      <div className="space-y-1">
        <span
          aria-disabled
          className={buttonVariants({ size: 'lg', className: 'pointer-events-none opacity-60' })}
        >
          {t('doctorPage.bookSoon')}
        </span>
        {p.bookingFee !== null && (
          <p className="text-center text-xs text-ink-muted">
            {t('doctorPage.bookingFee', { fee: formatRupees(p.bookingFee) })}
          </p>
        )}
      </div>

      {p.clinics.length > 0 && (
        <Section
          title={t('doctorPage.clinics')}
          icon={<MapPin className="size-5 text-brand-600" aria-hidden />}
        >
          <div className="space-y-3">
            {p.clinics.map((c) => (
              <ClinicCard key={c.id} clinic={c} t={t} />
            ))}
          </div>
        </Section>
      )}

      {p.bio && (
        <Section
          title={t('doctorPage.about')}
          icon={<UserRound className="size-5 text-brand-600" aria-hidden />}
        >
          <p className="whitespace-pre-line text-sm leading-relaxed">{p.bio}</p>
        </Section>
      )}

      {p.qualifications.length > 0 && (
        <Section
          title={t('doctorPage.qualifications')}
          icon={<Stethoscope className="size-5 text-brand-600" aria-hidden />}
        >
          <ul className="space-y-1 text-sm">
            {p.qualifications.map((q, i) => (
              <li key={i}>
                <span className="font-medium">{q.degree}</span>
                {[q.institute, q.year].filter(Boolean).length > 0 && (
                  <span className="text-ink-muted">
                    , {[q.institute, q.year].filter(Boolean).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.languages.length > 0 && (
        <Section
          title={t('doctorPage.languages')}
          icon={<Languages className="size-5 text-brand-600" aria-hidden />}
        >
          <p className="text-sm">{p.languages.join(', ')}</p>
        </Section>
      )}

      {(!p.ratingSummary || p.ratingSummary.count === 0) && (
        <p className="rounded-md bg-canvas px-3 py-3 text-center text-sm text-ink-muted">
          {t('doctorPage.newOnDoqtoBody')}
        </p>
      )}
    </article>
  );
}

/** schema.org Physician for search engines; `<` is escaped so text cannot close the script tag. */
export function physicianJsonLd(
  p: DoctorProfile,
  url: string,
  specialties: Record<string, string>,
): string {
  const clinic = p.clinics[0];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: p.name,
    url,
    ...(p.photoUrl ? { image: p.photoUrl } : {}),
    ...(p.bio ? { description: p.bio } : {}),
    medicalSpecialty: p.specialties.map((s) => specialties[s] ?? s),
    knowsLanguage: p.languages,
    ...(clinic
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: [clinic.address.line1, clinic.address.area].filter(Boolean).join(', '),
            addressLocality: clinic.address.city,
            addressRegion: clinic.address.state,
            postalCode: clinic.address.pincode,
            addressCountry: 'IN',
          },
          ...(clinic.location
            ? {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: clinic.location.coordinates[1],
                  longitude: clinic.location.coordinates[0],
                },
              }
            : {}),
          ...(clinic.phone ? { telephone: clinic.phone } : {}),
        }
      : {}),
    ...(p.consultFee !== null ? { priceRange: formatRupees(p.consultFee) } : {}),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
