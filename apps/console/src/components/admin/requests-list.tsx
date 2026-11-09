'use client';

import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { cn } from '@doqto/ui/cn';
import type { UnitStatus } from '@doqto/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/i18n/admin';
import { basePath } from '@/lib/admin-config';
import { applicationsKey, listApplications } from '@/lib/admin-api';
import { unitStatusTone } from '@/lib/unit-status';
import { KIND_ICON_BY_SERVICE } from './provider-meta';

const TABS: (UnitStatus | 'all')[] = ['pending', 'changes_requested', 'verified', 'rejected', 'all'];

export function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** Registration requests: every application from doctors, clinics, labs and pharmacies. */
export function RequestsList() {
  const t = useT();
  const [tab, setTab] = useState<UnitStatus | 'all'>('pending');
  const q = useQuery({ queryKey: applicationsKey(tab), queryFn: () => listApplications(tab) });
  const counts = q.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) - counts.draft : undefined;

  return (
    <>
      <PageHeader title={t('areas.requests.title')} description={t('areas.requests.description')} />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((s) => {
          const n = s === 'all' ? total : counts?.[s];
          return (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
                tab === s
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-line bg-white text-ink-muted hover:border-ink-muted',
              )}
            >
              {t(s === 'all' ? 'requests.tabAll' : (('unitStatus.' + s) as Parameters<typeof t>[0]))}
              <span className="rounded-full bg-surface px-1.5 text-xs tabular-nums text-ink">
                {n ?? '—'}
              </span>
            </button>
          );
        })}
      </div>

      <Panel>
        {q.isError ? (
          <p role="alert" className="p-4 text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : q.isPending ? (
          <p role="status" className="p-4 text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : q.data.items.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">{t('requests.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t('requests.colService')}</th>
                  <th className="px-4 py-2 font-semibold">{t('requests.colApplicant')}</th>
                  <th className="px-4 py-2 font-semibold">{t('requests.colSubmitted')}</th>
                  <th className="px-4 py-2 font-semibold">{t('requests.colStatus')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.items.map((a) => {
                  const Icon = KIND_ICON_BY_SERVICE[a.kind];
                  return (
                    <tr key={a.id} className="hover:bg-surface">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span>
                            <span className="block font-semibold text-ink">{a.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {t(('kindLabel.' + a.kind) as Parameters<typeof t>[0])}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-ink">{a.applicant.name}</span>
                        <span className="block text-xs text-ink-muted">
                          {a.applicant.email ?? a.applicant.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{formatWhen(a.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <StatusChip tone={unitStatusTone[a.status]}>
                          {t(('unitStatus.' + a.status) as Parameters<typeof t>[0])}
                        </StatusChip>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={basePath + '/requests/' + a.id}
                          className="font-semibold text-brand-700 hover:underline"
                        >
                          {t('requests.review')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
