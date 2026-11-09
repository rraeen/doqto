'use client';

import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';
import { useMe } from '@/lib/session';

export function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** Signed-in gate shared by the doctor pages; sends signed-out users to login and back. */
export function useSignedIn(next: string) {
  const t = useT();
  const me = useMe();
  if (me.isPending) return { node: <Loading /> };
  if (me.isError) {
    return {
      node: (
        <EmptyState
          title={t('common.somethingWrong')}
          action={
            <Button variant="outline" onClick={() => void me.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ),
    };
  }
  if (!me.data) {
    return {
      node: (
        <EmptyState
          icon={LogIn}
          title={t('doctor.notDoctor')}
          action={
            <Link
              href={`${next.startsWith('/clinic') ? '/clinic/login' : '/login'}?next=${encodeURIComponent(next)}`}
              className={buttonVariants({ size: 'lg' })}
            >
              {t('home.signIn')}
            </Link>
          }
        />
      ),
    };
  }
  return { me: me.data };
}
