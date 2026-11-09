'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Logo } from '@doqto/ui/logo';
import { PageHeader } from '@doqto/ui/page-header';
import { StatusChip } from '@doqto/ui/status-chip';
import { WORKSPACE_TYPES, type Workspace, type WorkspaceType } from '@doqto/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Pill, Plus, Stethoscope, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { useT } from '@/i18n/provider';
import { adminPath, applyPath, homeFor, loginPath } from '@/lib/app-config';
import { getMe, logout, meKey } from '@/lib/auth';
import { unitStatusTone } from '@/lib/unit-status';

export const SERVICE_ICONS: Record<WorkspaceType, LucideIcon> = {
  clinic: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
};

/**
 * The panel after sign-in. Approved services are cards that open their dashboards; applications
 * still being reviewed (or sent back for changes) show their status; and one "+" card starts an
 * application for a service the person has not applied for. Someone with exactly one approved
 * service lands on its dashboard instead and reaches this page from "All services" in the top bar.
 */
export function ServicesPanel() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const account = me.data;

  async function signOut() {
    await logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: meKey });
    router.replace(loginPath);
  }

  useEffect(() => {
    if (me.isError && isApiError(me.error) && me.error.status === 401) router.replace(loginPath);
    else if (me.data?.platformRole === 'admin' && me.data.workspaces.length === 0) router.replace(adminPath);
  }, [me.isError, me.error, me.data, router]);

  if (!account) {
    const failed = me.isError && !(isApiError(me.error) && me.error.status === 401);
    return (
      <p role="status" className="p-6 text-sm text-ink-muted">
        {failed ? t('common.somethingWrong') : t('common.loading')}
      </p>
    );
  }

  const order = (a: Workspace, b: Workspace) =>
    WORKSPACE_TYPES.indexOf(a.kind) - WORKSPACE_TYPES.indexOf(b.kind);
  const approved = account.workspaces.filter((w) => w.status === 'verified').sort(order);
  const others = account.workspaces.filter((w) => w.status !== 'verified').sort(order);
  const canApply =
    WORKSPACE_TYPES.some((k) => !account.workspaces.some((w) => w.kind === k)) ||
    others.some((w) => w.status === 'changes_requested' || w.status === 'draft');

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <Button variant="outline" size="sm" onClick={signOut}>
            {t('common.signOut')}
          </Button>
        </div>
      </header>
      <PageHeader
        title={t('panel.title')}
        description={t(account.workspaces.length === 0 ? 'panel.introEmpty' : 'panel.intro', {
          name: account.name,
        })}
      />

      {approved.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-3">
          {approved.map((w) => (
            <li key={w.id}>
              <ServiceCard workspace={w} />
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <section className="mt-6" aria-labelledby="applications">
          <h2 id="applications" className="mb-2 text-sm font-semibold text-ink">
            {t('panel.applications')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {others.map((w) => (
              <li key={w.id}>
                <ServiceCard workspace={w} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {canApply && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          <li>
            <Link
              href={applyPath}
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line p-4 text-center text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
            >
              <Plus className="size-8" aria-hidden />
              <span className="font-semibold">{t('panel.apply')}</span>
              <span className="text-sm text-ink-muted">{t('panel.applyHint')}</span>
            </Link>
          </li>
        </ul>
      )}
    </main>
  );
}

function ServiceCard({ workspace: w }: { workspace: Workspace }) {
  const t = useT();
  const Icon = SERVICE_ICONS[w.kind];
  const approved = w.status === 'verified';
  const fixable = w.status === 'changes_requested' || w.status === 'draft';
  const href = approved ? homeFor(w.kind) : fixable ? `${applyPath}?kind=${w.kind}` : undefined;
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">
            {t(('workspaceTypes.' + w.kind) as Parameters<typeof t>[0])}
          </span>
          <span className="block truncate text-sm text-ink-muted">{w.name}</span>
        </span>
      </span>
      <span className="mt-3 block">
        <StatusChip tone={unitStatusTone[w.status]}>
          {t(('unitStatus.' + w.status) as Parameters<typeof t>[0])}
        </StatusChip>
      </span>
      <span className="mt-2 block text-sm text-ink-muted">
        {t(('unitHint.' + w.status) as Parameters<typeof t>[0])}
      </span>
      {w.reviewNote && (w.status === 'changes_requested' || w.status === 'rejected') && (
        <span className="mt-3 block rounded-sm bg-warning-bg px-3 py-2 text-sm text-ink">
          <span className="block text-xs font-semibold uppercase tracking-wide text-warning">
            {t('panel.noteFromDoqto')}
          </span>
          {w.reviewNote}
        </span>
      )}
      {href && (
        <span className="mt-3 block text-sm font-semibold text-brand-700">
          {t(approved ? 'panel.open' : 'panel.update')}
        </span>
      )}
    </>
  );
  const cls = 'neu-raised block h-full rounded-md p-4';
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:brightness-105`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
