'use client';

import { isApiError } from '@doqto/api-client';
import { AppShell, type NavGroup } from '@doqto/ui/app-shell';
import { Button } from '@doqto/ui/button';
import { Logo } from '@doqto/ui/logo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useT } from '@/i18n/admin';
import { loginPath, servicesPath } from '@/lib/app-config';
import { environmentTag, groups, productName, tone } from '@/lib/admin-config';
import { getMe, logout, meKey } from '@/lib/auth';
import { LanguageSwitch } from './language-switch';

/**
 * The frame of the admin area: dark top bar, an ADMIN tag and the staff navigation. It asks the API
 * who is signed in. Nobody signed in goes to the console login; a signed-in provider is sent to
 * their own services. (The API checks the admin role on every request; this only decides what to show.)
 */
export function AdminChrome({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, staleTime: 60_000, retry: false });
  const signedOut = me.isError && isApiError(me.error) && me.error.status === 401;
  const isAdmin = me.data?.platformRole === 'admin';
  useEffect(() => {
    if (signedOut) router.replace(loginPath);
    else if (me.data && !isAdmin) router.replace(servicesPath);
  }, [signedOut, me.data, isAdmin, router]);
  async function signOut() {
    await logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: meKey });
    router.replace(loginPath);
  }
  const nav = useMemo<NavGroup[]>(
    () =>
      groups.map((g) => ({
        label: t(g.labelKey as Parameters<typeof t>[0]),
        items: g.items.map((i) => ({
          href: i.href,
          label: t(('nav.' + i.key) as Parameters<typeof t>[0]),
          icon: i.icon,
        })),
      })),
    [t],
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
      skipLabel={t('common.skip')}
      openMenuLabel={t('common.openMenu')}
      closeMenuLabel={t('common.closeMenu')}
      topbar={
        <div className="flex items-center gap-3">
          {me.data && <span className="hidden text-sm text-white/80 sm:inline">{me.data.name}</span>}
          <LanguageSwitch dark />
          <Button variant="outline" size="sm" onClick={signOut}>
            {t('common.signOut')}
          </Button>
        </div>
      }
    >
      {isAdmin ? (
        children
      ) : (
        <p role="status" className="p-6 text-sm text-ink-muted">
          {me.isError && !signedOut ? t('common.somethingWrong') : t('common.loading')}
        </p>
      )}
    </AppShell>
  );
}
