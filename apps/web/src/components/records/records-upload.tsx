'use client';

import { RECORD_FILE_MAX_BYTES, RECORD_FILE_TYPES, RECORD_STATUSES } from '@doqto/shared';
import { FileText, Plus } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { FileButton } from '@/components/ui/file-button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { todayIst } from '@/lib/booking';
import { useUploadRecord } from '@/lib/records';
import { useNow } from '@/lib/use-now';
import {
  CATEGORIES,
  STATUS_LABEL,
  VISIT_TYPES,
  type RecordKind,
  type RecordStatus,
  type VisitType,
} from '@/lib/records-view';

const select =
  'neu-inset h-tap w-full rounded-2xl border-0 px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/40';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

/** Add a report, prescription or scan: a file plus the details the list is searched by. */
export function UploadRecord({ trigger }: { trigger: ReactNode }) {
  const { t } = useI18n();
  const upload = useUploadRecord();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RecordKind>('lab');
  const [visitType, setVisitType] = useState<VisitType>('OP');
  const [doctorName, setDoctorName] = useState('');
  const [facility, setFacility] = useState('');
  const [date, setDate] = useState(() => todayIst(Date.now()));
  const [status, setStatus] = useState<RecordStatus>('completed');

  const reset = () => {
    setFile(null);
    setTitle('');
    setKind('lab');
    setVisitType('OP');
    setDoctorName('');
    setFacility('');
    setDate(todayIst(Date.now()));
    setStatus('completed');
  };

  const ready = Boolean(file && title.trim().length >= 2 && doctorName.trim().length >= 2 && date);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t('records.needFile'));
      return;
    }
    if (!ready) return;
    upload.mutate(
      {
        file,
        fields: {
          title: title.trim(),
          kind,
          visitType,
          doctorName: doctorName.trim(),
          facility: facility.trim(),
          date,
          status,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('records.saved'));
          setOpen(false);
          reset();
        },
        onError: () => toast.error(t('records.saveFailed')),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={t('records.addReport')}
      description={t('records.uploadIntro')}
      closeLabel={t('common.close')}
      className="sm:max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-medium text-ink">{t('records.fileLabel')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <FileButton
              accept={[...RECORD_FILE_TYPES]}
              maxBytes={RECORD_FILE_MAX_BYTES}
              onSelect={setFile}
              onReject={(reason) =>
                toast.error(t(reason === 'type' ? 'records.fileBadType' : 'records.fileTooBig'))
              }
            >
              {file ? t('records.changeFile') : t('records.chooseFile')}
            </FileButton>
            {file && (
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-brand-700">
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{file.name}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted">{t('records.fileHint')}</p>
        </div>

        <Field label={t('records.titleLabel')}>
          <Input
            value={title}
            maxLength={120}
            placeholder={t('records.titlePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('records.categoryLabel')}>
            <select
              className={select}
              value={kind}
              onChange={(e) => setKind(e.target.value as RecordKind)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-1">
            <span className="text-sm font-medium text-ink">{t('records.visitTypeLabel')}</span>
            <div role="radiogroup" aria-label={t('records.visitTypeLabel')} className="flex gap-2">
              {VISIT_TYPES.map((v) => (
                <Chip
                  key={v.id}
                  kind="radio"
                  selected={visitType === v.id}
                  onClick={() => setVisitType(v.id)}
                >
                  {t(v.label)}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <Field label={t('records.doctorLabel')}>
          <Input
            value={doctorName}
            maxLength={120}
            placeholder={t('records.doctorPlaceholder')}
            onChange={(e) => setDoctorName(e.target.value)}
          />
        </Field>
        <Field label={t('records.facilityLabel')}>
          <Input value={facility} maxLength={120} onChange={(e) => setFacility(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('records.dateLabel')}>
            <input
              type="date"
              value={date}
              max={now > 0 ? todayIst(now) : undefined}
              onChange={(e) => setDate(e.target.value)}
              className="neu-inset h-tap w-full min-w-0 rounded-2xl bg-transparent px-4 text-base text-ink focus:outline-none"
            />
          </Field>
          <Field label={t('records.statusLabel')}>
            <select
              className={select}
              value={status}
              onChange={(e) => setStatus(e.target.value as RecordStatus)}
            >
              {RECORD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">{t('records.privacyNote')}</p>
        <Button type="submit" className="w-full" loading={upload.isPending} disabled={!ready}>
          <Plus className="size-5" aria-hidden />
          {t('records.saveRecord')}
        </Button>
      </form>
    </Sheet>
  );
}
