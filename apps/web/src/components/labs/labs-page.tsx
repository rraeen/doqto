'use client';

import { FlaskConical, Home, MapPin, Search, ShieldCheck, Timer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { useDebounced } from '@/lib/records';
import { useLabs } from '@/lib/labs';

/** The approved labs: search by city, open one to pick tests and send a request. */
export function LabsPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const labs = useLabs(useDebounced(search, 300).trim() || undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t('labs.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('labs.intro')}</p>
        </div>
        <Link href="/lab-bookings" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {t('labs.myBookings')}
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input
          type="search"
          className="pl-12"
          aria-label={t('labs.cityPlaceholder')}
          placeholder={t('labs.cityPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {labs.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-28 w-full rounded-3xl" />
          <Skeleton className="h-28 w-full rounded-3xl" />
        </div>
      ) : labs.isError ? (
        <p role="alert" className="text-sm text-danger">
          {t('common.somethingWrong')}
        </p>
      ) : labs.data.items.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t('labs.none')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {labs.data.items.map((lab) => (
            <li key={lab.id} className="neu-card flex flex-col gap-3 rounded-3xl p-5">
              <div>
                <h2 className="text-lg font-bold text-ink">{lab.name}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                  <MapPin className="size-4" aria-hidden /> {lab.city}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {lab.nablAccredited && (
                  <Badge tone="success">
                    <ShieldCheck className="size-3.5" aria-hidden /> {t('labs.nabl')}
                  </Badge>
                )}
                {lab.homeCollection && (
                  <Badge tone="brand">
                    <Home className="size-3.5" aria-hidden /> {t('labs.home')}
                  </Badge>
                )}
                {lab.turnaroundHours && (
                  <Badge tone="neutral">
                    <Timer className="size-3.5" aria-hidden /> {t('labs.turnaround', { hours: lab.turnaroundHours })}
                  </Badge>
                )}
              </div>
              {lab.matchedTests.length > 0 && (
                <p className="text-sm font-medium text-brand-700">
                  {t('labs.matched', { tests: lab.matchedTests.join(', ') })}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-3">
                <span className="text-sm text-ink-muted">{t('labs.tests', { count: lab.testCount })}</span>
                <Link href={`/labs/${lab.slug}`} className={buttonVariants({ size: 'sm' })}>
                  {t('labs.view')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
