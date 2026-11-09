'use client';

import type { AdminDoctorQueueItem, VerificationStatus } from '@doqto/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Loading } from '@/components/shell/signed-in';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n/provider';
import { adminApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';
import { cn } from '@/lib/cn';
import { isStatus, queueKey, STATUSES, useAdminGate, useDate } from './admin-common';

export function AdminQueuePage({ specialties }: { specialties: Record<string, string> }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const raw = params.get('status');
  const status: VerificationStatus = isStatus(raw) ? raw : 'pending';
  const gate = useAdminGate(`/admin/doctors${raw ? `?status=${raw}` : ''}`);
  const queue = useInfiniteQuery({
    queryKey: queueKey(status),
    queryFn: ({ pageParam, signal }) => adminApi.listDoctorQueue(status, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: gate.ok,
  });
  return (
    <div className="space-y-4">
      <PageTitle>{t('adminVerify.title')}</PageTitle>
      <div role="tablist" className="flex gap-1 rounded-lg bg-canvas p-1">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            role="tab"
            aria-selected={s.value === status}
            href={s.value === 'pending' ? '/admin/doctors' : `/admin/doctors?status=${s.value}`}
            replace
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-center text-sm font-medium',
              s.value === status ? 'neu-raised text-ink' : 'text-ink-muted',
            )}
          >
            {t(s.label)}
          </Link>
        ))}
      </div>
      {!gate.ok ? (
        gate.node
      ) : queue.isPending ? (
        <Loading />
      ) : queue.isError ? (
        <EmptyState
          title={authErrorMessage(queue.error, t)}
          action={
            <Button variant="outline" onClick={() => void queue.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <QueueList
          items={queue.data.pages.flatMap((p) => p.items)}
          specialties={specialties}
          more={
            queue.hasNextPage && (
              <Button
                variant="outline"
                className="w-full"
                loading={queue.isFetchingNextPage}
                onClick={() => void queue.fetchNextPage()}
              >
                {t('adminVerify.loadMore')}
              </Button>
            )
          }
        />
      )}
    </div>
  );
}

function QueueList({
  items,
  specialties,
  more,
}: {
  items: AdminDoctorQueueItem[];
  specialties: Record<string, string>;
  more: ReactNode;
}) {
  const { t } = useI18n();
  const date = useDate();
  if (items.length === 0) return <EmptyState title={t('adminVerify.empty')} />;
  return (
    <>
      <ul className="space-y-3">
        {items.map((d) => (
          <li key={d.id}>
            <Link
              href={`/admin/doctors/${d.id}`}
              className="flex items-center gap-3 rounded-lg neu-raised p-4 hover:brightness-105"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">{d.name}</p>
                <p className="truncate text-sm text-ink-muted">
                  {[d.specialties.map((s) => specialties[s] ?? s).join(', '), d.city]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-xs text-ink-muted">
                  {d.registration.council} · {d.registration.number}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  {t('adminVerify.submitted', { date: date(d.submittedAt) })}
                  <span className={d.documentUploaded ? 'text-success' : 'text-warning'}>
                    {d.documentUploaded
                      ? t('adminVerify.hasDocument')
                      : t('adminVerify.noDocument')}
                  </span>
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {more}
    </>
  );
}
