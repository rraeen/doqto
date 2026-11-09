'use client';

import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';
import { useMe } from '@/lib/session';
import { ProfileEdit } from './profile-edit';
import { ProfileOverview } from './profile-overview';

/**
 * `/profile` shows the overview, `/profile/edit` the edit form, and a new user's first visit
 * (`?welcome=1`) goes straight to the form. `nameMax` is the contract's `NAME_MAX`, passed from
 * the server page to keep Zod out of the bundle.
 */
export function ProfileView({ nameMax, mode }: { nameMax: number; mode: 'overview' | 'edit' }) {
  const t = useT();
  const me = useMe();
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';

  if (me.isPending) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <EmptyState
        title={t('common.somethingWrong')}
        action={
          <Button variant="outline" onClick={() => void me.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('profile.signInPrompt')}
        action={
          <Link
            href={`/login?next=${mode === 'edit' ? '/profile/edit' : '/profile'}`}
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  // Remount when the user changes so the name field starts from saved data.
  return mode === 'edit' || welcome ? (
    <ProfileEdit key={me.data.id} me={me.data} nameMax={nameMax} welcome={welcome} />
  ) : (
    <ProfileOverview me={me.data} />
  );
}
