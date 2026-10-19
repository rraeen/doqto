'use client';

import type { AdminDoctorDetail } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileCheck2,
  FileWarning,
  RefreshCw,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Loading } from '@/components/shell/signed-in';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { isApiError } from '@/lib/api/errors';
import { adminApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';
import { formatE164ForDisplay } from '@/lib/phone';
import { detailKey, STATUSES, TONE, useAdminGate } from './admin-common';

// Dialog code loads when the admin first approves or rejects, not with the page.
const Sheet = dynamic(() => import('@/components/ui/sheet').then((m) => m.Sheet), { ssr: false });
const ConfirmSheet = dynamic(
  () => import('@/components/ui/confirm-sheet').then((m) => m.ConfirmSheet),
  { ssr: false },
);

export function AdminDoctorPage({
  id,
  specialties,
}: {
  id: string;
  specialties: Record<string, string>;
}) {
  const { t } = useI18n();
  const gate = useAdminGate(`/admin/doctors/${id}`);
  const detail = useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => adminApi.getDoctorForReview(id, signal),
    enabled: gate.ok,
    // Every view is audit-logged and mints a new link: do not refetch behind the admin's back.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: (n, err) => !isApiError(err, 'NOT_FOUND') && !isApiError(err, 'FORBIDDEN') && n < 2,
  });
  const back = (
    <Link href="/admin/doctors" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
      <ArrowLeft className="size-4" aria-hidden />
      {t('adminVerify.back')}
    </Link>
  );
  if (!gate.ok) return gate.node;
  if (detail.isPending) return <Loading />;
  if (detail.isError) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title={
            isApiError(detail.error, 'NOT_FOUND')
              ? t('empty.notFound')
              : authErrorMessage(detail.error, t)
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-4 pb-28">
      {back}
      <DoctorReview
        detail={detail.data}
        specialties={specialties}
        reload={() => void detail.refetch()}
        reloading={detail.isFetching}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-2 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DoctorReview({
  detail,
  specialties,
  reload,
  reloading,
}: {
  detail: AdminDoctorDetail;
  specialties: Record<string, string>;
  reload: () => void;
  reloading: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const d = detail.doctor;
  const status = d.verification.status;
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | undefined>();

  const decide = useMutation({
    mutationFn: (body: { decision: 'approve' | 'reject'; notes?: string }) =>
      adminApi.verifyDoctor(d.id, { ...body, reviewToken: detail.reviewToken }),
    onSuccess: (_profile, body) => {
      toast.success(
        body.decision === 'approve' ? t('adminVerify.approved') : t('adminVerify.rejected'),
      );
      void qc.invalidateQueries({ queryKey: ['admin', 'doctors'] });
      qc.removeQueries({ queryKey: detailKey(d.id) });
      router.push('/admin/doctors');
    },
    onError: (err) => {
      setConfirming(false);
      setRejecting(false);
      if (isApiError(err, 'CONFLICT')) {
        // The doctor changed something, or another admin decided, since this page loaded.
        toast.error(t('adminVerify.changed'));
        reload();
      } else {
        toast.error(authErrorMessage(err, t));
      }
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageTitle>{d.name}</PageTitle>
        <Badge tone={TONE[status]}>{t(STATUSES.find((s) => s.value === status)!.label)}</Badge>
      </div>
      {d.verification.notes && (
        <p className="rounded-md bg-canvas px-3 py-2 text-sm">{d.verification.notes}</p>
      )}
      <Card>
        <dl className="divide-y divide-line">
          <Row label={t('adminVerify.phone')}>
            {detail.phone ? formatE164ForDisplay(detail.phone) : '—'}
          </Row>
          <Row label={t('adminVerify.city')}>{d.city ?? '—'}</Row>
          <Row label={t('adminVerify.registration')}>
            {d.registration.council}
            <br />
            {d.registration.number} · {d.registration.year}
          </Row>
          <Row label={t('adminVerify.specialties')}>
            {d.specialties.map((s) => specialties[s] ?? s).join(', ') || '—'}
          </Row>
          <Row label={t('adminVerify.qualifications')}>
            {d.qualifications.length
              ? d.qualifications
                  .map((q) => [q.degree, q.institute, q.year].filter(Boolean).join(', '))
                  .join('; ')
              : '—'}
          </Row>
        </dl>
      </Card>
      <DocumentPreview detail={detail} reload={reload} reloading={reloading} />

      {status === 'pending' && (
        <div className="sticky bottom-4 z-10 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            className="bg-surface text-danger shadow-lg"
            onClick={() => setRejecting(true)}
          >
            <X className="size-5" aria-hidden />
            {t('adminVerify.reject')}
          </Button>
          <Button
            size="lg"
            className="shadow-lg"
            disabled={!d.registration.documentUploaded}
            onClick={() => setConfirming(true)}
          >
            <Check className="size-5" aria-hidden />
            {t('adminVerify.approve')}
          </Button>
          {!d.registration.documentUploaded && (
            <p className="col-span-2 text-center text-sm text-ink-muted">
              {t('adminVerify.approveNeedsDocument')}
            </p>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmSheet
          open
          onOpenChange={setConfirming}
          title={t('adminVerify.approve')}
          description={t('adminVerify.approveConfirm', { name: d.name })}
          confirmLabel={t('adminVerify.approve')}
          cancelLabel={t('common.cancel')}
          loading={decide.isPending}
          onConfirm={() => decide.mutate({ decision: 'approve' })}
        />
      )}
      {rejecting && (
        <Sheet
          open
          onOpenChange={setRejecting}
          title={t('adminVerify.rejectTitle')}
          closeLabel={t('common.cancel')}
        >
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const text = notes.trim();
              if (text.length < 5) {
                setNotesError(t('adminVerify.rejectNotesShort'));
                return;
              }
              decide.mutate({ decision: 'reject', notes: text });
            }}
          >
            <Field
              label={t('adminVerify.rejectNotesLabel')}
              hint={t('adminVerify.rejectNotesHint')}
              error={notesError}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  rows={4}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesError(undefined);
                  }}
                />
              )}
            </Field>
            <Button type="submit" variant="danger" size="lg" loading={decide.isPending}>
              {t('adminVerify.reject')}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}

/** Signed link to the private scan (5 minutes). Images preview inline; PDFs open in a new tab. */
function DocumentPreview({
  detail,
  reload,
  reloading,
}: {
  detail: AdminDoctorDetail;
  reload: () => void;
  reloading: boolean;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState<string | null>(null);
  const expiresAt = detail.documentUrlExpiresAt ? Date.parse(detail.documentUrlExpiresAt) : null;
  // The expiry that has passed; a reload brings a new expiry, so the stale flag no longer matches.
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = window.setTimeout(
      () => setExpiredAt(expiresAt),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  const isExpired = expiresAt !== null && expiredAt === expiresAt;
  const url = detail.documentUrl;

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {url ? (
          <FileCheck2 className="size-5 text-success" aria-hidden />
        ) : (
          <FileWarning className="size-5 text-warning" aria-hidden />
        )}
        {t('adminVerify.document')}
      </h2>
      {!url ? (
        <p className="text-sm text-ink-muted">{t('adminVerify.noDocument')}</p>
      ) : isExpired ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">{t('adminVerify.documentExpired')}</p>
          <Button variant="outline" loading={reloading} onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            {t('adminVerify.refreshLink')}
          </Button>
        </div>
      ) : (
        <>
          {failed !== url && (
            <a href={url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, never cached or optimised */}
              <img
                src={url}
                alt={t('adminVerify.document')}
                className="max-h-[60vh] w-full rounded-md border border-line bg-canvas object-contain"
                referrerPolicy="no-referrer"
                onError={() => setFailed(url)}
              />
            </a>
          )}
          {failed === url && <p className="text-sm text-ink-muted">{t('adminVerify.pdfHint')}</p>}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', className: 'w-full' })}
          >
            <ExternalLink className="size-4" aria-hidden />
            {t('adminVerify.openDocument')}
          </a>
        </>
      )}
    </Card>
  );
}
