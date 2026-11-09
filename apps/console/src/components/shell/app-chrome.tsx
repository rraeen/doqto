'use client';

import { AppShell, type NavGroup } from '@doqto/ui/app-shell';
import { Logo } from '@doqto/ui/logo';
import Link from 'next/link';
import { isApiError } from '@doqto/api-client';
import { Button, buttonVariants } from '@doqto/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useT } from '@/i18n/provider';
import {
  servicesPath,
  loginPath,
  environmentTag,
  productName,
  tone,
  workspaces,
  type WorkspaceType,
} from '@/lib/app-config';
import { getMe, logout, meKey } from '@/lib/auth';
import { LanguageSwitch } from './language-switch';

/**
 * The signed-in frame for one workspace type: sidebar, top bar and content. It asks the API who
 * is signed in; nobody signed in goes to the sign-in page, and an account without this service goes
 * back to its panel. (The server checks access on every request; this only decides what to show.)
 */
export function AppChrome({ type, children }: { type: WorkspaceType; children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, staleTime: 60_000, retry: false });
  const account = me.data;
  const signedOut = me.isError && isApiError(me.error) && me.error.status === 401;
  // Only an approved service opens a dashboard.
  const unit = account?.workspaces.find((w) => w.kind === type && w.status === 'verified');
  useEffect(() => {
    if (signedOut) router.replace(loginPath);
    // An account that does not have this service goes to the panel (or its only dashboard).
    else if (account && !unit) router.replace(servicesPath);
  }, [signedOut, account, unit, router]);
  async function signOut() {
    await logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: meKey });
    router.replace(loginPath);
  }
  const nav = useMemo<NavGroup[]>(
    () =>
      workspaces[type].groups.map((g) => ({
        label: t(g.labelKey as Parameters<typeof t>[0]),
        items: g.items.map((i) => ({
          href: i.href,
          label: t(('nav.' + i.key) as Parameters<typeof t>[0]),
          icon: i.icon,
        })),
      })),
    [t, type],
  );
  return (
    <AppShell
      productName={productName}
      logo={<Logo markOnly />}
      environmentTag={environmentTag}
      tone={tone}
      nav={nav}
      activePath={pathname}
      LinkComponent={Link}
      workspace={
        <span className="text-sm font-semibold text-ink">
          {t(('workspaceTypes.' + type) as Parameters<typeof t>[0])}
        </span>
      }
      skipLabel={t('common.skip')}
      openMenuLabel={t('common.openMenu')}
      closeMenuLabel={t('common.closeMenu')}
      topbar={
        <div className="flex items-center gap-3">
          {account && <span className="hidden text-sm text-ink-muted sm:inline">{account.name}</span>}
          {account && (
            <Link href={servicesPath} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {t('common.allServices')}
            </Link>
          )}
          <LanguageSwitch />
          <Button variant="outline" size="sm" onClick={signOut}>
            {t('common.signOut')}
          </Button>
        </div>
      }
    >
      {unit ? (
        <>
          {children}
        </>
      ) : (
        <GateMessage failed={me.isError && !signedOut} />
      )}
    </AppShell>
  );
}

function GateMessage({ failed }: { failed: boolean }) {
  const t = useT();
  return (
    <p role="status" className="p-6 text-sm text-ink-muted">
      {failed ? t('common.somethingWrong') : t('common.loading')}
    </p>
  );
}
