'use client';

import {
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  LogIn,
  Microscope,
  Pill,
  Plus,
  ScanLine,
  Search,
  Stethoscope,
  Syringe,
  Trash2,
  UserRound,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { env } from '@/lib/env';
import { downloadTextFile } from '@/lib/prescription';
import { downloadRecordFile, fromApiRecord, useDeleteRecord, useRecords } from '@/lib/records';
import {
  NO_FILTERS,
  STATUS_LABEL,
  STATUS_TONE,
  recordDoctors,
  recordsText,
  sampleRecords,
  visibleRecords,
  type HealthRecord,
  type RecordFilters,
  type RecordKind,
} from '@/lib/records-view';
import { useMe } from '@/lib/session';
import { useNow } from '@/lib/use-now';
import { RecordsFilter } from './records-filter';
import { UploadRecord } from './records-upload';

const KIND_ICON: Record<RecordKind, LucideIcon> = {
  lab: Microscope,
  discharge: ClipboardList,
  diagnostics: ScanLine,
  opd: Stethoscope,
  prescription: Pill,
  vaccination: Syringe,
  other: FileText,
};

function useFormat() {
  const { locale } = useI18n();
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return (day: string) =>
    new Intl.DateTimeFormat(tag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
}

/** The list as a text file (the details of each record; the files themselves download one by one). */
function useListFile() {
  const { t } = useI18n();
  const labels = {
    doctor: t('records.fileDoctor'),
    facility: t('records.fileFacility'),
    date: t('records.fileDate'),
    status: t('records.fileStatus'),
  };
  const status = (s: HealthRecord['status']) => t(STATUS_LABEL[s]);
  return {
    all: (rs: readonly HealthRecord[]) =>
      downloadTextFile(
        'health-records.txt',
        recordsText(rs, t('records.fileTitleAll'), labels, status),
      ),
    one: (r: HealthRecord) =>
      downloadTextFile(
        `record-${r.id}.txt`,
        recordsText([r], t('records.fileTitle'), labels, status),
      ),
  };
}

function RecordRow({
  r,
  onDownload,
  onDelete,
}: {
  r: HealthRecord;
  onDownload: (r: HealthRecord) => void;
  onDelete?: (r: HealthRecord) => void;
}) {
  const { t } = useI18n();
  const fmt = useFormat();
  const Icon = KIND_ICON[r.kind];
  const body = (
    <div className="flex items-center gap-3.5 sm:gap-6">
      <span className="neu-inset flex size-11 shrink-0 items-center justify-center rounded-full text-brand-600 sm:size-14">
        <Icon className="size-5 sm:size-7" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="break-words text-base font-bold leading-snug text-ink sm:text-xl">
          {r.title}
        </h2>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-brand-700 sm:mt-1 sm:gap-x-4">
          <span className="flex items-center gap-1">
            <UserRound className="size-4" aria-hidden />
            {r.doctor}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden />
            {fmt(r.date)}
          </span>
          <span className="text-ink-muted">{r.visitType}</span>
        </div>
        {r.facility && <p className="mt-0.5 truncate text-sm text-ink-muted">{r.facility}</p>}
      </div>
    </div>
  );
  return (
    <li className="neu-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-6">
      {r.appointmentId && !r.file ? (
        <Link
          href={`/appointments/${r.appointmentId}/prescription`}
          aria-label={`${t('records.openPrescription')}: ${r.title}`}
          className="min-w-0 flex-1 hover:opacity-90 sm:min-w-[14rem]"
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 sm:min-w-[14rem]">{body}</div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 sm:justify-start sm:border-0 sm:pt-0">
        <Badge
          tone={STATUS_TONE[r.status]}
          className="px-3 py-1 uppercase tracking-wider sm:px-4 sm:py-1.5"
        >
          {t(STATUS_LABEL[r.status])}
        </Badge>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 sm:size-tap"
            aria-label={`${t('records.download')}: ${r.title}`}
            title={t('records.download')}
            onClick={() => onDownload(r)}
          >
            <Download className="size-5" aria-hidden />
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 text-danger sm:size-tap"
              aria-label={`${t('records.delete')}: ${r.title}`}
              title={t('records.delete')}
              onClick={() => onDelete(r)}
            >
              <Trash2 className="size-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function RecordsPage() {
  const { t } = useI18n();
  const me = useMe();
  const now = useNow();
  const listFile = useListFile();
  const [filters, setFilters] = useState<RecordFilters>(NO_FILTERS);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<HealthRecord | null>(null);
  const remove = useDeleteRecord();

  // With the API mocks (no server), the page shows example rows as a design preview.
  const preview = env.apiMocks;
  const signedIn = Boolean(me.data);
  const query = useRecords(filters, search, signedIn);
  const sample = useMemo(() => (preview && now > 0 ? sampleRecords(now) : []), [preview, now]);

  const first = query.data?.pages[0];
  const rows: HealthRecord[] = preview
    ? visibleRecords(sample, filters, search)
    : (query.data?.pages.flatMap((p) => p.items) ?? []).map(fromApiRecord);
  const doctors = preview ? recordDoctors(sample) : (first?.doctors ?? []);
  const total = preview ? rows.length : (first?.total ?? 0);
  const narrowed = Boolean(search.trim()) || JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const download = (r: HealthRecord) => {
    if (!r.file) {
      listFile.one(r);
      return;
    }
    downloadRecordFile(r.id).catch(() => toast.error(t('records.downloadFailed')));
  };

  let body;
  if (me.isPending || (preview && now === 0) || (signedIn && !preview && query.isPending)) {
    body = (
      <div className="space-y-4" aria-busy>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  } else if (!signedIn) {
    body = (
      <EmptyState
        icon={LogIn}
        title={t('records.signIn')}
        action={
          <Link
            href="/login?next=%2Frecords"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  } else if (query.isError) {
    body = (
      <EmptyState
        icon={FolderOpen}
        title={t('common.somethingWrong')}
        action={
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    body = narrowed ? (
      <EmptyState
        icon={FolderOpen}
        title={t('records.noMatch')}
        description={t('records.noMatchBody')}
      />
    ) : (
      <EmptyState
        icon={FolderOpen}
        title={t('records.emptyAll')}
        description={t('records.emptyAllBody')}
      />
    );
  } else {
    body = (
      <div className="space-y-4 sm:space-y-6">
        <ul className="space-y-4 sm:space-y-6">
          {rows.map((r) => (
            <RecordRow
              key={r.id}
              r={r}
              onDownload={download}
              onDelete={r.file ? setToDelete : undefined}
            />
          ))}
        </ul>
        {!preview && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-sm text-ink-muted">
              {t('records.showing', { shown: rows.length, total })}
            </p>
            {query.hasNextPage && (
              <Button
                variant="outline"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t('records.loadMore')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  const live = signedIn && (preview ? now > 0 : true);

  return (
    <div className="space-y-6 md:space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4 md:gap-5">
        <div className="space-y-1 md:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
            {t('records.title')}
          </h1>
          <p className="text-base font-medium text-brand-700 md:text-lg">{t('records.subtitle')}</p>
        </div>
        {live && (
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
            {!preview && (
              <UploadRecord
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="px-4 text-sm text-brand-700 sm:px-6 sm:text-base"
                  >
                    <Plus className="size-5" aria-hidden />
                    {t('records.addReport')}
                  </Button>
                }
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="px-4 text-sm sm:px-6 sm:text-base"
              disabled={rows.length === 0}
              onClick={() => listFile.all(rows)}
            >
              <Download className="size-5" aria-hidden />
              {t('records.downloadAll')}
            </Button>
          </div>
        )}
      </div>

      {live && (
        <div className="space-y-4 sm:space-y-6">
          <label className="neu-inset flex h-12 w-full items-center gap-3 rounded-2xl px-5 sm:h-14">
            <Search className="size-5 shrink-0 text-brand-600" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('records.searchLabel')}
              placeholder={t('records.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted/60 focus:outline-none sm:text-lg"
            />
          </label>
          <RecordsFilter filters={filters} onChange={setFilters} doctors={doctors} />
        </div>
      )}

      <section aria-live="polite">{body}</section>

      <ConfirmSheet
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t('records.deleteTitle')}
        description={toDelete ? `${toDelete.title}. ${t('records.deleteBody')}` : undefined}
        confirmLabel={t('records.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        danger
        loading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('records.deleted'));
              setToDelete(null);
            },
            onError: () => toast.error(t('records.deleteFailed')),
          });
        }}
      />
    </div>
  );
}
