'use client';

import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import Link from 'next/link';
import { useT } from '@/i18n/provider';
import { canOpenArea } from '@/lib/app-config';
import { useLabBookings, useLabUnit } from './lab-shared';

/** Today at a glance: what needs the lab's attention, linking to the screen that deals with it. */
export function LabDashboard() {
  const t = useT();
  const { unitId, unit } = useLabUnit();
  // Only someone who can open a booking screen may ask for the bookings (the API says the same).
  const allowed = Boolean(
    unit &&
      (canOpenArea('labBookings', unit) || canOpenArea('collection', unit) || canOpenArea('reports', unit)),
  );
  const bookings = useLabBookings(unitId, allowed);
  const items = bookings.data?.items ?? [];
  const count = (...s: string[]) => items.filter((b) => s.includes(b.status)).length;

  const cards = [
    { label: t('lab.dash.requests'), n: count('requested'), href: '/lab/bookings', area: 'labBookings' as const },
    { label: t('lab.dash.toCollect'), n: count('accepted'), href: '/lab/collection', area: 'collection' as const },
    { label: t('lab.dash.processing'), n: count('sample_collected', 'processing'), href: '/lab/reports', area: 'reports' as const },
    { label: t('lab.dash.ready'), n: count('report_ready'), href: '/lab/bookings', area: 'labBookings' as const },
  ];

  return (
    <>
      <PageHeader title={t('areas.dashboard.title')} description={t('areas.dashboard.description')} />
      {allowed ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.label}>
              <Panel>
                <p className="text-3xl font-bold text-ink">{bookings.isPending ? '–' : c.n}</p>
                <p className="mt-1 text-sm text-ink-muted">{c.label}</p>
                {unit && canOpenArea(c.area, unit) && (
                  <Link href={c.href} className="mt-2 inline-block text-sm font-semibold text-brand-700 underline underline-offset-4">
                    {t('lab.dash.open')}
                  </Link>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
