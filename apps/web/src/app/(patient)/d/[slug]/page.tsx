import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  DoctorProfileView,
  displayCity,
  physicianJsonLd,
} from '@/components/doctor-page/profile-view';
import { Page } from '@/components/shell/page';
import { getTranslator } from '@/i18n/server';
import { fetchDoctorProfile } from '@/lib/api/server';
import { specialtyLabels } from '@/lib/contract-data';
import { env } from '@/lib/env';
import { sampleProfileBySlug } from '@/lib/sample-doctors';

interface Props {
  params: Promise<{ slug: string }>;
}

// One API call per request for both the metadata and the page.
const loadProfile = cache(fetchDoctorProfile);

const photoHost = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [profile, { t, locale }] = await Promise.all([loadProfile(slug), getTranslator()]);
  if (!profile) {
    // Mock mode may still find the doctor in the browser's mock store (see the page below).
    if (process.env.NEXT_PUBLIC_API_MOCKS === 'true') return { robots: { index: false } };
    return { title: t('doctorPage.notFoundTitle'), robots: { index: false } };
  }
  const labels = specialtyLabels(locale);
  const vars = {
    name: profile.name,
    specialty: profile.specialties.map((s) => labels[s] ?? s)[0] ?? '',
    city: displayCity(profile),
  };
  const title = t('doctorPage.metaTitle', vars);
  const description = t('doctorPage.metaDescription', vars);
  const path = `/d/${profile.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'profile',
      title,
      description,
      url: path,
      ...(profile.photoUrl ? { images: [{ url: profile.photoUrl, alt: profile.name }] } : {}),
    },
  };
}

export default async function DoctorPage({ params }: Props) {
  const { slug } = await params;
  const [profile, { t, locale }] = await Promise.all([loadProfile(slug), getTranslator()]);
  const specialties = specialtyLabels(locale);
  if (!profile) {
    // Literal env check so the build drops the mock-only client code when mocks are off.
    if (process.env.NEXT_PUBLIC_API_MOCKS === 'true') {
      const { MockProfileFallback } = await import('@/components/doctor-page/mock-fallback');
      return (
        <Page size="wide">
          <MockProfileFallback slug={slug} specialties={specialties} />
        </Page>
      );
    }
    // Demo and local builds: the example doctors from the search cards have a page too.
    const sample =
      env.demoMode || process.env.NODE_ENV !== 'production' ? sampleProfileBySlug(slug) : null;
    if (sample) {
      return (
        <Page size="wide">
          <DoctorProfileView profile={sample} t={t} specialties={specialties} photoHost={null} />
        </Page>
      );
    }
    notFound();
  }
  return (
    <Page size="wide">
      <script
        type="application/ld+json"
        // Escaped in physicianJsonLd, so profile text cannot break out of the script element.
        dangerouslySetInnerHTML={{
          __html: physicianJsonLd(profile, `${env.siteUrl}/d/${profile.slug}`, specialties),
        }}
      />
      <DoctorProfileView profile={profile} t={t} specialties={specialties} photoHost={photoHost} />
    </Page>
  );
}
