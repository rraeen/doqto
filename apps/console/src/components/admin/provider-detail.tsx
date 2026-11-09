'use client';

import { Button } from '@doqto/ui/button';
import { PageHeader } from '@doqto/ui/page-header';
import { PlannedPanel } from '@doqto/ui/planned-panel';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/admin';
import { areas, basePath, type ProviderKind } from '@/lib/admin-config';
import { KIND_ICON, KIND_SINGULAR } from './provider-meta';

const TOOLS = [
  'detail.toolProfile',
  'detail.toolBookings',
  'detail.toolReviews',
  'detail.toolPayments',
  'detail.toolAudit',
  'detail.toolSuspend',
  'detail.toolEdit',
] as const;

/**
 * One provider: their own dashboard (read-only, so staff see what the provider sees) beside the
 * admin tools. The extra tools are still to be agreed (plan section 4.8).
 */
export function ProviderDetail({ kind, id }: { kind: ProviderKind; id: string }) {
  const t = useT();
  const phase = areas.find((a) => a.key === kind)?.phase ?? '';
  return (
    <>
      <Link
        href={basePath + '/' + kind}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('detail.back')}
      </Link>
      <PageHeader
        eyebrow={t(KIND_SINGULAR[kind])}
        title={t('detail.id') + ' ' + id}
        actions={
          <Button variant="outline" size="sm" disabled>
            {t('detail.viewAs')}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={t('detail.theirDashboard')} description={t('detail.theirDashboardNote')}>
            <PlannedPanel
              icon={KIND_ICON[kind]}
              title={t('common.plannedNote')}
              phase={<StatusChip tone="info">{t('common.planned', { phase })}</StatusChip>}
            />
          </Panel>
        </div>
        <Panel title={t('detail.adminTools')}>
          <ul className="space-y-2 text-sm text-ink">
            {TOOLS.map((tool) => (
              <li key={tool} className="rounded-sm border border-line px-3 py-2 text-ink-muted">
                {t(tool)}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
