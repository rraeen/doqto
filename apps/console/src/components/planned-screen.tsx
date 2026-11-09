'use client';

import { PageHeader } from '@doqto/ui/page-header';
import { PlannedPanel } from '@doqto/ui/planned-panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { useT } from '@/i18n/provider';
import { areasOf, type AreaKey, type WorkspaceType } from '@/lib/app-config';

/** A screen that is on the roadmap but not built: says so, and names the phase that builds it. */
export function PlannedScreen({ type, area }: { type: WorkspaceType; area: AreaKey }) {
  const t = useT();
  const item = areasOf(type).find((a) => a.key === area);
  const title = t(('areas.' + area + '.title') as Parameters<typeof t>[0]);
  const description = t(('areas.' + area + '.description') as Parameters<typeof t>[0]);
  return (
    <>
      <PageHeader title={title} description={description} />
      <PlannedPanel
        icon={item?.icon}
        title={t('common.plannedNote')}
        phase={
          <StatusChip tone="info">{t('common.planned', { phase: item?.phase ?? '' })}</StatusChip>
        }
      />
    </>
  );
}
