'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Field, Input, inputClass } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { cn } from '@doqto/ui/cn';
import {
  DELAY_MINUTES_MAX,
  DOCTOR_STATES,
  type DaySheetItem,
  type DoctorState,
} from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import {
  addEntry,
  authErrorKey,
  callNext,
  checkInPatient,
  confirmAppointment,
  dayKey,
  getDay,
  isValidIdentifier,
  markNoShow,
  moveInQueue,
  normalizeIdentifier,
  sendCheckInCode,
  setLiveStatus,
} from '@/lib/auth';
import { formatTime } from '@/lib/dates';
import { istToday } from '@/lib/dates';
import { TONE } from './appointments-screen';
import { useClinicUnit } from './schedule-editor';

const ACTIVE_ROWS = 'divide-y divide-line';

function Person({ item }: { item: DaySheetItem }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-semibold text-ink">{item.patientName}</span>
      <span className="block text-xs text-ink-muted">{item.patientPhone}</span>
    </span>
  );
}

/**
 * The visit day, for the clinic or doctor: who is with the doctor, who is waiting (in the order the
 * clinic will call them), who is booked but has not arrived, and a button to call the next patient.
 * The doctor's live status, which patients see, is set here too. Everything is for today.
 */
export function QueueScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const { unitId, loading } = useClinicUnit();
  const date = istToday();

  const day = useQuery({
    queryKey: dayKey(unitId ?? '', date),
    queryFn: () => getDay(unitId!, date),
    enabled: Boolean(unitId),
    refetchInterval: 10_000,
  });

  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [checkingIn, setCheckingIn] = useState<string>();
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState<string>();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['console', 'appointments'] });
  }
  const fail = (err: unknown) => {
    setMessage({
      ok: false,
      text: isApiError(err, 'CONFLICT') ? t('queue.changed') : t(authErrorKey(err)),
    });
    void refresh();
  };
  const ok = (text: string) => {
    setMessage({ ok: true, text });
    void refresh();
  };

  const next = useMutation({
    mutationFn: (currentId: string | null) => callNext(unitId!, currentId),
    onSuccess: (r) => {
      ok(
        r.appointment
          ? t('queue.called', { name: r.appointment.patientName })
          : t('queue.noneLeft'),
      );
    },
    onError: fail,
  });
  const noShow = useMutation({
    mutationFn: (id: string) => markNoShow(unitId!, id),
    onSuccess: () => ok(t('queue.markedNoShow')),
    onError: fail,
  });
  const move = useMutation({
    mutationFn: (v: { id: string; before: string }) => moveInQueue(unitId!, v.id, v.before),
    onSuccess: () => ok(t('queue.moved')),
    onError: fail,
  });
  const confirm = useMutation({
    mutationFn: (id: string) => confirmAppointment(unitId!, id),
    onSuccess: () => ok(t('appointments.confirmed')),
    onError: fail,
  });
  const checkIn = useMutation({
    mutationFn: (v: { id: string; method: 'visit_code' | 'otp'; code: string }) =>
      checkInPatient(unitId!, { appointmentId: v.id, method: v.method, code: v.code }),
    onSuccess: (r) => {
      setCheckingIn(undefined);
      setCode('');
      setCodeSent(undefined);
      ok(t('queue.checkedIn', { token: r.appointment?.queueToken ?? '' }));
    },
    onError: fail,
  });
  const sendCode = useMutation({
    mutationFn: (id: string) => sendCheckInCode(unitId!, id),
    onSuccess: (_r, id) => {
      setCodeSent(id);
      setMessage({ ok: true, text: t('queue.codeSent') });
    },
    onError: fail,
  });

  const header = (
    <PageHeader title={t('areas.queue.title')} description={t('areas.queue.description')} />
  );
  if (loading) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-ink-muted">
          {t('common.loading')}
        </p>
      </>
    );
  }
  if (!unitId) {
    return (
      <>
        {header}
        <Panel>
          <p className="p-4 text-sm text-ink-muted">{t('appointments.notApproved')}</p>
        </Panel>
      </>
    );
  }

  const items = day.data?.items ?? [];
  const status = day.data?.status ?? null;
  const inConsult = items.find((i) => i.status === 'in_consult');
  const waiting = items.filter((i) => i.status === 'checked_in');
  const booked = items.filter((i) => i.status === 'confirmed');
  const toConfirm = items.filter((i) => i.status === 'pending_confirmation');
  const finished = items.filter((i) =>
    ['completed', 'no_show', 'cancelled_by_patient', 'cancelled_by_clinic', 'expired'].includes(
      i.status,
    ),
  );
  const canCall = Boolean(inConsult) || waiting.length > 0;

  return (
    <>
      {header}
      <div aria-live="polite">
        {message && (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={cn('mb-4 text-sm', message.ok ? 'text-success' : 'text-danger')}
          >
            {message.text}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={t('queue.nowTitle')}>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              {inConsult ? (
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700">
                    {inConsult.queueToken ?? '—'}
                  </span>
                  <Person item={inConsult} />
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  {waiting.length > 0 ? t('queue.nobodyIn') : t('queue.nobodyWaiting')}
                </p>
              )}
              <Button
                size="lg"
                className="w-auto"
                disabled={!canCall || next.isPending}
                loading={next.isPending}
                onClick={() => next.mutate(inConsult?.id ?? null)}
              >
                {inConsult ? t('queue.finishAndNext') : t('queue.callNext')}
              </Button>
            </div>
          </Panel>

          <Panel
            title={t('queue.waitingTitle', { n: waiting.length })}
            description={t('queue.waitingHint')}
          >
            {waiting.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">{t('queue.waitingNone')}</p>
            ) : (
              <ul className={ACTIVE_ROWS}>
                {waiting.map((i, idx) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-surface text-sm font-bold text-ink">
                        {i.queueToken ?? '—'}
                      </span>
                      <Person item={i} />
                    </span>
                    <span className="flex items-center gap-2 text-sm text-ink-muted">
                      {t('queue.since', { time: formatTime(i.checkInAt) })}
                    </span>
                    <span className="flex items-center gap-2">
                      {idx > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={move.isPending}
                          onClick={() => move.mutate({ id: i.id, before: waiting[0]!.id })}
                        >
                          {t('queue.toFront')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={noShow.isPending}
                        onClick={() => noShow.mutate(i.id)}
                      >
                        {t('queue.noShow')}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={t('queue.bookedTitle', { n: booked.length })}
            description={t('queue.bookedHint')}
          >
            {booked.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">{t('queue.bookedNone')}</p>
            ) : (
              <ul className={ACTIVE_ROWS}>
                {booked.map((i) => {
                  const method = i.hasVisitCode ? 'visit_code' : 'otp';
                  const open = checkingIn === i.id;
                  return (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="flex items-center gap-3">
                          <span className="w-20 text-sm font-semibold text-ink">
                            {formatTime(i.slotStart)}
                          </span>
                          <Person item={i} />
                          {i.rescheduled && (
                            <StatusChip tone="warning">{t('appointments.moved')}</StatusChip>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setCheckingIn(open ? undefined : i.id);
                              setCode('');
                              setCodeSent(undefined);
                            }}
                          >
                            {t('queue.checkIn')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={noShow.isPending}
                            onClick={() => noShow.mutate(i.id)}
                          >
                            {t('queue.noShow')}
                          </Button>
                        </span>
                      </div>
                      {open && (
                        <form
                          className="mt-3 flex flex-wrap items-end gap-3 rounded-sm bg-surface p-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!/^\d{4,6}$/.test(code)) {
                              setMessage({ ok: false, text: t('authError.codeFormat') });
                              return;
                            }
                            checkIn.mutate({ id: i.id, method, code });
                          }}
                        >
                          <Field
                            label={
                              method === 'visit_code' ? t('queue.visitCode') : t('queue.otpCode')
                            }
                            className="w-40"
                          >
                            {({ id }) => (
                              <Input
                                id={id}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                              />
                            )}
                          </Field>
                          {method === 'otp' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              loading={sendCode.isPending}
                              onClick={() => sendCode.mutate(i.id)}
                            >
                              {codeSent === i.id ? t('queue.sendAgain') : t('queue.sendCode')}
                            </Button>
                          )}
                          <Button type="submit" size="sm" loading={checkIn.isPending}>
                            {t('queue.checkInConfirm')}
                          </Button>
                          <p className="basis-full text-xs text-ink-muted">
                            {method === 'visit_code'
                              ? t('queue.visitCodeHint')
                              : t('queue.otpHint')}
                          </p>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {toConfirm.length > 0 && (
            <Panel
              title={t('queue.confirmTitle', { n: toConfirm.length })}
              description={t('queue.confirmHint')}
            >
              <ul className={ACTIVE_ROWS}>
                {toConfirm.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-20 text-sm font-semibold text-ink">
                        {formatTime(i.slotStart)}
                      </span>
                      <Person item={i} />
                    </span>
                    <Button
                      size="sm"
                      loading={confirm.isPending && confirm.variables === i.id}
                      onClick={() => confirm.mutate(i.id)}
                    >
                      {t('appointments.confirm')}
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {finished.length > 0 && (
            <Panel title={t('queue.finishedTitle', { n: finished.length })}>
              <ul className={ACTIVE_ROWS}>
                {finished.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-20 text-sm text-ink-muted">{formatTime(i.slotStart)}</span>
                      <Person item={i} />
                    </span>
                    <StatusChip tone={TONE[i.status]}>
                      {t(('appointments.status.' + i.status) as Parameters<typeof t>[0])}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <StatusPanel
            unitId={unitId}
            current={status}
            onDone={(text) => ok(text)}
            onError={fail}
          />
          <WalkInPanel unitId={unitId} onDone={(text) => ok(text)} onError={fail} />
        </div>
      </div>
    </>
  );
}

/** The live status patients see on the doctor's page and in their own queue view. */
function StatusPanel({
  unitId,
  current,
  onDone,
  onError,
}: {
  unitId: string;
  current: {
    state: DoctorState;
    delayMinutes: number;
    message: string | null;
    currentToken: number | null;
    queueLength: number;
  } | null;
  onDone: (text: string) => void;
  onError: (err: unknown) => void;
}) {
  const t = useT();
  const [state, setState] = useState<DoctorState | undefined>();
  const [delay, setDelay] = useState<string>('');
  const [note, setNote] = useState<string | undefined>();
  const chosen = state ?? current?.state ?? 'not_started';
  const delayValue =
    delay !== '' ? delay : current?.delayMinutes ? String(current.delayMinutes) : '';
  const noteValue = note ?? current?.message ?? '';
  const [invalid, setInvalid] = useState<string>();

  const save = useMutation({
    mutationFn: () =>
      setLiveStatus(unitId, {
        state: chosen,
        ...(chosen === 'running_late' ? { delayMinutes: Number(delayValue) } : {}),
        message: noteValue.trim() === '' ? null : noteValue.trim(),
      }),
    onSuccess: () => {
      setState(undefined);
      setDelay('');
      setNote(undefined);
      onDone(t('queue.statusSaved'));
    },
    onError,
  });

  return (
    <Panel title={t('queue.statusTitle')} description={t('queue.statusHint')}>
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            chosen === 'running_late' &&
            !(Number(delayValue) > 0 && Number(delayValue) <= DELAY_MINUTES_MAX)
          ) {
            setInvalid(t('queue.delayInvalid', { max: DELAY_MINUTES_MAX }));
            return;
          }
          setInvalid(undefined);
          save.mutate();
        }}
      >
        {current && (
          <p className="text-sm text-ink-muted">
            {t('queue.statusNow', {
              serving: current.currentToken ?? '—',
              waiting: current.queueLength,
            })}
          </p>
        )}
        <Field label={t('queue.statusState')}>
          {({ id }) => (
            <select
              id={id}
              className={cn(inputClass)}
              value={chosen}
              onChange={(e) => setState(e.target.value as DoctorState)}
            >
              {DOCTOR_STATES.map((s) => (
                <option key={s} value={s}>
                  {t(('queue.state.' + s) as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          )}
        </Field>
        {chosen === 'running_late' && (
          <Field label={t('queue.statusDelay')} error={invalid}>
            {({ id, invalid: bad }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={DELAY_MINUTES_MAX}
                aria-invalid={bad}
                value={delayValue}
                onChange={(e) => setDelay(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field label={t('queue.statusMessage')} hint={t('queue.statusMessageHint')}>
          {({ id }) => (
            <Input
              id={id}
              maxLength={80}
              value={noteValue}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={save.isPending}>
          {t('queue.statusSave')}
        </Button>
      </form>
    </Panel>
  );
}

/** A patient who walked in, or booked by phone or WhatsApp: no online fee, joins today's list. */
function WalkInPanel({
  unitId,
  onDone,
  onError,
}: {
  unitId: string;
  onDone: (text: string) => void;
  onError: (err: unknown) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<'walk_in' | 'phone_manual' | 'whatsapp_manual'>('walk_in');
  const [error, setError] = useState<string>();

  const add = useMutation({
    mutationFn: () =>
      addEntry(unitId, {
        source,
        patientName: name.trim(),
        patientPhone: normalizeIdentifier(phone),
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      onDone(t('queue.walkInAdded'));
    },
    onError,
  });

  return (
    <Panel title={t('queue.walkInTitle')} description={t('queue.walkInHint')}>
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const p = normalizeIdentifier(phone);
          if (name.trim().length < 1 || !/^\+91[6-9]\d{9}$/.test(p) || !isValidIdentifier(p)) {
            setError(t('queue.walkInInvalid'));
            return;
          }
          setError(undefined);
          add.mutate();
        }}
      >
        <Field label={t('queue.walkInName')}>
          {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('queue.walkInPhone')} error={error}>
          {({ id, invalid }) => (
            <Input
              id={id}
              inputMode="tel"
              aria-invalid={invalid}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('queue.walkInSource')}>
          {({ id }) => (
            <select
              id={id}
              className={cn(inputClass)}
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="walk_in">{t('appointments.source.walk_in')}</option>
              <option value="phone_manual">{t('appointments.source.phone_manual')}</option>
              <option value="whatsapp_manual">{t('appointments.source.whatsapp_manual')}</option>
            </select>
          )}
        </Field>
        <Button type="submit" variant="outline" className="w-full" loading={add.isPending}>
          {t('queue.walkInAdd')}
        </Button>
      </form>
    </Panel>
  );
}
