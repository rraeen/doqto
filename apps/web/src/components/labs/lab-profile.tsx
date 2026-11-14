'use client';

import { isApiError } from '@/lib/api/errors';
import type { LabTest } from '@doqto/shared';
import { ArrowLeft, Home, LogIn, MapPin, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Textarea, inputClass } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { useCreateLabBooking, useLab } from '@/lib/labs';
import { formatRupees } from '@/lib/money';
import { useMe } from '@/lib/session';

const WINDOWS = ['morning', 'afternoon', 'evening'] as const;
const todayIst = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const plusDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** One lab: its tests by category, a cart, and the request form. Nothing is paid online. */
export function LabProfile({ slug }: { slug: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useMe();
  const lab = useLab(slug);
  const book = useCreateLabBooking(slug);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'lab' | 'home'>('lab');
  const [date, setDate] = useState(() => plusDays(todayIst(), 1));
  const [window, setWindow] = useState<(typeof WINDOWS)[number]>('morning');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ tests?: string; name?: string; address?: string; form?: string }>({});
  const money = (p: number) => formatRupees(p, locale === 'hi' ? 'hi-IN' : 'en-IN');

  const tests = lab.data?.catalogue.tests ?? [];
  const chosen = useMemo(() => tests.filter((x) => picked.includes(x.id)), [tests, picked]);
  const total = chosen.reduce((sum, x) => sum + x.pricePaise, 0);
  const homeOk = Boolean(lab.data?.homeCollection) && chosen.length > 0 && chosen.every((x) => x.homeCollection);
  // Group by category, the lab's own order inside each.
  const needle = filter.trim().toLowerCase();
  const groups = useMemo(() => {
    const map = new Map<string, LabTest[]>();
    const visible = needle
      ? tests.filter((x) => `${x.name} ${x.categoryName ?? ''}`.toLowerCase().includes(needle))
      : tests;
    for (const x of visible) map.set(x.categoryName ?? '', [...(map.get(x.categoryName ?? '') ?? []), x]);
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  }, [tests, needle]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function submit() {
    const next: typeof errors = {};
    if (chosen.length === 0) next.tests = t('labs.errTests');
    if (name.trim().length < 2) next.name = t('labs.errName');
    if (mode === 'home' && address.trim().length < 5) next.address = t('labs.errAddress');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    book.mutate(
      {
        testIds: chosen.map((x) => x.id),
        patientName: name.trim(),
        mode: mode === 'home' && homeOk ? 'home' : 'lab',
        date,
        window,
        ...(mode === 'home' ? { address: address.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (b) => {
          toast.success(t('labs.sent'));
          router.push(`/lab-bookings/${b.id}`);
        },
        onError: (err) =>
          setErrors({ form: isApiError(err, 'CONFLICT') ? t('labs.tooMany') : t('labs.failed') }),
      },
    );
  }

  if (lab.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (lab.isError || !lab.data) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title={t('labs.none')}
        action={
          <Link href="/labs" className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}>
            {t('labs.back')}
          </Link>
        }
      />
    );
  }
  const data = lab.data;

  return (
    <div className="space-y-6">
      <Link href="/labs" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ArrowLeft className="size-4" aria-hidden /> {t('labs.back')}
      </Link>

      <header className="neu-card space-y-2 rounded-3xl p-5">
        <h1 className="text-2xl font-bold text-ink">{data.name}</h1>
        <p className="flex items-start gap-1 text-sm text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {data.address}, {data.city}
        </p>
        <div className="flex flex-wrap gap-2">
          {data.nablAccredited && (
            <Badge tone="success">
              <ShieldCheck className="size-3.5" aria-hidden /> {t('labs.nabl')}
            </Badge>
          )}
          {data.homeCollection && (
            <Badge tone="brand">
              <Home className="size-3.5" aria-hidden /> {t('labs.home')}
            </Badge>
          )}
        </div>
      </header>

      <section aria-labelledby="tests-title" className="space-y-3">
        <h2 id="tests-title" className="text-lg font-bold text-ink">
          {t('labs.catalogueTitle')}
        </h2>
        {tests.length > 6 && (
          <Input
            type="search"
            aria-label={t('labs.filterTests')}
            placeholder={t('labs.filterTests')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        {groups.length === 0 ? (
          <p className="text-sm text-ink-muted">{tests.length === 0 ? t('labs.noTests') : t('labs.noMatch')}</p>
        ) : (
          groups.map(([category, list]) => (
            <div key={category || 'other'} className="neu-card rounded-3xl p-4">
              {category && <p className="mb-1 text-sm font-bold text-brand-700">{category}</p>}
              <ul className="divide-y divide-line">
                {list.map((x) => (
                  <li key={x.id} className="flex items-start justify-between gap-3 py-2">
                    <Checkbox
                      className="flex-1"
                      checked={picked.includes(x.id)}
                      onChange={() => toggle(x.id)}
                      label={
                        <span className="block">
                          <span className="font-semibold">{x.name}</span>
                          {x.homeCollection && (
                            <span className="ml-2 text-xs text-brand-700">{t('labs.homeOnlyTag')}</span>
                          )}
                          {x.sampleType && (
                            <span className="block text-xs text-ink-muted">{t('labs.sample', { text: x.sampleType })}</span>
                          )}
                          {x.preparation && (
                            <span className="block text-xs text-ink-muted">{t('labs.prep', { text: x.preparation })}</span>
                          )}
                        </span>
                      }
                    />
                    <span className="shrink-0 text-sm font-bold text-ink">{money(x.pricePaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {errors.tests && (
          <p role="alert" className="text-sm text-danger">
            {errors.tests}
          </p>
        )}
      </section>

      {tests.length > 0 && (
        <section aria-labelledby="request-title" className="neu-card space-y-4 rounded-3xl p-5">
          <h2 id="request-title" className="text-lg font-bold text-ink">
            {t('labs.formTitle')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('labs.selected', { count: chosen.length })} · <strong>{t('labs.total', { amount: money(total) })}</strong>
          </p>
          <p className="text-xs text-ink-muted">{t('labs.payAtLab')}</p>

          {me.isPending ? (
            <Skeleton className="h-12 w-full" />
          ) : !me.data ? (
            <Link
              href={`/login?next=${encodeURIComponent(`/labs/${slug}`)}`}
              className={buttonVariants({ size: 'lg', className: 'w-full' })}
            >
              <LogIn className="size-5" aria-hidden /> {t('labs.signIn')}
            </Link>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              noValidate
            >
              <Field label={t('labs.name')} error={errors.name}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} value={name} maxLength={120} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setName(e.target.value)} />
                )}
              </Field>
              <fieldset className="space-y-1">
                <legend className="mb-1 text-sm font-medium text-ink">{t('labs.mode')}</legend>
                <label className="flex min-h-tap items-center gap-3 text-sm">
                  <input type="radio" name="mode" checked={mode === 'lab'} onChange={() => setMode('lab')} className="size-5 accent-brand-600" />
                  {t('labs.modeLab')}
                </label>
                <label className="flex min-h-tap items-center gap-3 text-sm">
                  <input type="radio" name="mode" checked={mode === 'home'} disabled={!homeOk} onChange={() => setMode('home')} className="size-5 accent-brand-600" />
                  {t('labs.modeHome')}
                </label>
                {!homeOk && chosen.length > 0 && <p className="text-xs text-ink-muted">{t('labs.homeUnavailable')}</p>}
              </fieldset>
              {mode === 'home' && homeOk && (
                <Field label={t('labs.address2')} hint={t('labs.addressHint')} error={errors.address}>
                  {({ id, describedBy, invalid }) => (
                    <Textarea id={id} maxLength={400} aria-describedby={describedBy} aria-invalid={invalid} value={address} onChange={(e) => setAddress(e.target.value)} />
                  )}
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('labs.date')}>
                  {({ id }) => (
                    <Input id={id} type="date" min={todayIst()} max={plusDays(todayIst(), 30)} value={date} onChange={(e) => setDate(e.target.value)} />
                  )}
                </Field>
                <Field label={t('labs.window')}>
                  {({ id }) => (
                    <select id={id} className={inputClass} value={window} onChange={(e) => setWindow(e.target.value as typeof window)}>
                      {WINDOWS.map((w) => (
                        <option key={w} value={w}>
                          {t(`labs.window_${w}` as const)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field label={t('labs.note')}>
                {({ id }) => <Textarea id={id} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              {errors.form && (
                <p role="alert" className="text-sm text-danger">
                  {errors.form}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" loading={book.isPending}>
                {t('labs.submit')}
              </Button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
