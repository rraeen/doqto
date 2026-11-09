'use client';

import { buttonVariants } from '@doqto/ui/button';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useT } from '@/i18n/admin';
import { basePath, providerKinds } from '@/lib/admin-config';
import { applicationsKey, listApplications } from '@/lib/admin-api';
import { KIND_ICON } from './provider-meta';

const DASH = '—';

/**
 * The root dashboard: registration requests first (they need action), then a card for each kind
 * of provider. The number of requests waiting is real; the provider counts stay placeholders until
 * the provider lists are built.
 */
export function AdminDashboard() {
  const t = useT();
  const pending = useQuery({
    queryKey: applicationsKey('pending'),
    queryFn: () => listApplications('pending'),
  });
  const waiting = pending.data?.counts.pending;
  return (
    <>
      <PageHeader
        title={t('areas.dashboard.title')}
        description={t('areas.dashboard.description')}
      />

      <Panel
        title={t('dashboard.requestsTitle')}
        actions={
          <Link
            href={basePath + '/requests'}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {t('dashboard.openRequests')}
          </Link>
        }
      >
        <div className="flex items-center gap-4">
          <span className="text-4xl font-bold tabular-nums text-ink">{waiting ?? DASH}</span>
          <p className="max-w-xl text-sm text-ink-muted">
            {waiting === 0 ? t('dashboard.requestsNone') : t('dashboard.requestsEmpty')}
          </p>
        </div>
      </Panel>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">{t('dashboard.countsTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {providerKinds.map((kind) => {
          const Icon = KIND_ICON[kind];
          return (
            <Link
              key={kind}
              href={basePath + '/' + kind}
              className="group rounded-sm border border-line bg-white p-4 transition-colors hover:border-brand-600"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-brand-700 group-hover:underline">
                  {t('dashboard.openList')}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-ink-muted">
                {t(('kinds.' + kind) as Parameters<typeof t>[0])}
              </p>
              <p className="text-3xl font-bold tabular-nums text-ink">{DASH}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {(['pending', 'verified', 'suspended'] as const).map((s) => (
                  <div key={s}>
                    <dt className="text-ink-muted">
                      {t(('dashboard.' + s) as Parameters<typeof t>[0])}
                    </dt>
                    <dd className="font-semibold tabular-nums text-ink">{DASH}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ink-muted">{t('dashboard.statNote')}</p>
    </>
  );
}
