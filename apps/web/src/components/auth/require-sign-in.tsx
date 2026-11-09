'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/session';

/**
 * Keeps a page for signed-in patients only. Someone who is not signed in is sent to the login page
 * and brought back to this exact page afterwards. While the session is being checked (and while
 * the redirect happens) a placeholder shows, so the page never flashes. If the check itself fails
 * (the server is unreachable) the page is shown rather than locking everyone out.
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const signedOut = !me.isPending && !me.isError && !me.data;

  useEffect(() => {
    if (!signedOut) return;
    const query = params.toString();
    const next = `${pathname}${query ? `?${query}` : ''}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [signedOut, pathname, params, router]);

  if (me.isPending || signedOut) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  return <>{children}</>;
}
