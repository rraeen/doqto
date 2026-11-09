'use client';

import { buttonVariants } from '@doqto/ui/button';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useT } from '@/i18n/provider';
import { applyPath } from '@/lib/app-config';
import { getMe, meKey } from '@/lib/auth';
import { unitStatusTone } from '@/lib/unit-status';
import { SERVICE_ICONS } from './services-panel';

/**
 * Settings > Your services: every service the account applied for with its status, and "Add more
 * services", which opens the same application form used the first time.
 */
export function ServicesSettings() {
  const t = useT();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const workspaces = me.data?.workspaces ?? [];
  return (
    <Panel
      title={t('settings.servicesTitle')}
      description={t('settings.servicesIntro')}
      actions={
        <Link href={applyPath} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('settings.addServices')}
        </Link>
      }
      className="mb-6"
    >
      <ul className="divide-y divide-line">
        {workspaces.map((w) => {
          const Icon = SERVICE_ICONS[w.kind];
          return (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-3">
                <Icon className="size-5 text-brand-700" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {t(('workspaceTypes.' + w.kind) as Parameters<typeof t>[0])}
                  </span>
                  <span className="block text-xs text-ink-muted">{w.name}</span>
                </span>
              </span>
              <StatusChip tone={unitStatusTone[w.status]}>
                {t(('unitStatus.' + w.status) as Parameters<typeof t>[0])}
              </StatusChip>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
