'use client';

import { Input } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { PlannedPanel } from '@doqto/ui/planned-panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { useT } from '@/i18n/admin';
import { areas, type ProviderKind } from '@/lib/admin-config';
import { KIND_ICON } from './provider-meta';

const FILTERS = ['all', 'pending', 'verified', 'suspended'] as const;

/** List of one provider type, with the search box and status filters it will have. */
export function ProviderList({ kind }: { kind: ProviderKind }) {
  const t = useT();
  const phase = areas.find((a) => a.key === kind)?.phase ?? '';
  return (
    <>
      <PageHeader
        title={t(('areas.' + kind + '.title') as Parameters<typeof t>[0])}
        description={t(('areas.' + kind + '.description') as Parameters<typeof t>[0])}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          disabled
          placeholder={t('list.search')}
          aria-label={t('list.search')}
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <StatusChip key={f}>{t(('list.' + f) as Parameters<typeof t>[0])}</StatusChip>
          ))}
        </div>
      </div>
      <PlannedPanel
        icon={KIND_ICON[kind]}
        title={t('common.plannedNote')}
        phase={<StatusChip tone="info">{t('common.planned', { phase })}</StatusChip>}
      />
    </>
  );
}
