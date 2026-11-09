'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { cn } from '@doqto/ui/cn';
import { Input, inputClass } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { PutScheduleRequestSchema } from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import { authErrorKey, getMe, getSchedule, meKey, putSchedule, scheduleKey } from '@/lib/auth';
import {
  SESSIONS_PER_DAY_MAX,
  SLOT_CHOICES,
  WEEK,
  WINDOW_DAYS_MAX,
  emptyState,
  fromSchedule,
  toRequest,
  typicalWeek,
  type DayNumber,
  type ScheduleState,
} from '@/lib/schedule';

/** The clinic service of this account that Doqto approved: the one that has a schedule. */
export function useClinicUnit() {
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const unit = me.data?.workspaces.find((w) => w.kind === 'clinic' && w.status === 'verified');
  return { unitId: unit?.id, loading: me.isPending };
}

/**
 * Weekly hours: which days the doctor sees patients and in which sessions, and how long a slot is.
 * Patients can book only inside these hours, so a newly listed doctor has no slots until this is
 * saved. Leave days and the walk-in share are kept as they are.
 */
export function ScheduleEditor() {
  const t = useT();
  const queryClient = useQueryClient();
  const { unitId, loading } = useClinicUnit();
  const saved = useQuery({
    queryKey: scheduleKey(unitId ?? ''),
    queryFn: () => getSchedule(unitId!),
    enabled: Boolean(unitId),
  });

  // What is on screen: the person's unsaved edits if there are any, otherwise what is saved.
  const [edited, setEdited] = useState<ScheduleState>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const state = edited ?? (saved.data ? fromSchedule(saved.data) : emptyState());
  const dirty = edited !== undefined;

  const save = useMutation({
    mutationFn: () => putSchedule(unitId!, toRequest(state)),
    onSuccess: async (s) => {
      queryClient.setQueryData(scheduleKey(unitId!), s);
      setEdited(undefined);
      setMessage({ ok: true, text: t('schedule.saved') });
    },
    onError: (err) =>
      setMessage({
        ok: false,
        text: isApiError(err, 'VALIDATION_FAILED') ? t('schedule.invalid') : t(authErrorKey(err)),
      }),
  });

  function edit(fn: (s: ScheduleState) => ScheduleState) {
    setEdited(fn(state));
    setMessage(undefined);
  }
  const setDay = (d: DayNumber, patch: Partial<ScheduleState['days'][DayNumber]>) =>
    edit((s) => ({ ...s, days: { ...s.days, [d]: { ...s.days[d], ...patch } } }));

  function submit() {
    if (!PutScheduleRequestSchema.safeParse(toRequest(state)).success) {
      setMessage({ ok: false, text: t('schedule.invalid') });
      return;
    }
    save.mutate();
  }

  const header = (
    <PageHeader title={t('areas.schedule.title')} description={t('areas.schedule.description')} />
  );

  if (loading || (unitId && saved.isPending)) {
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
          <p className="p-4 text-sm text-ink-muted">{t('schedule.notApproved')}</p>
        </Panel>
      </>
    );
  }

  const noHours = WEEK.every((d) => !state.days[d].on || state.days[d].sessions.length === 0);

  return (
    <>
      {header}
      {saved.data?.updatedAt === null && (
        <p role="status" className="mb-4 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
          {t('schedule.noneYet')}
        </p>
      )}
      <Panel
        title={t('schedule.weekTitle')}
        description={t('schedule.weekHint')}
        actions={
          <Button variant="outline" size="sm" onClick={() => edit((s) => typicalWeek(s))}>
            {t('schedule.typical')}
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {WEEK.map((d) => {
            const day = state.days[d];
            return (
              <li key={d} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3">
                <label className="flex min-h-tap w-36 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand-600"
                    checked={day.on}
                    onChange={(e) =>
                      setDay(d, {
                        on: e.target.checked,
                        sessions:
                          e.target.checked && day.sessions.length === 0
                            ? [{ start: '10:00', end: '13:00' }]
                            : day.sessions,
                      })
                    }
                  />
                  {t(('schedule.day.' + d) as Parameters<typeof t>[0])}
                </label>

                {day.on ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    {day.sessions.map((s, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={t('schedule.from')}
                          className="w-36"
                          value={s.start}
                          onChange={(e) =>
                            setDay(d, {
                              sessions: day.sessions.map((x, j) =>
                                j === i ? { ...x, start: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <span className="text-sm text-ink-muted">{t('schedule.to')}</span>
                        <Input
                          type="time"
                          aria-label={t('schedule.until')}
                          className="w-36"
                          value={s.end}
                          onChange={(e) =>
                            setDay(d, {
                              sessions: day.sessions.map((x, j) =>
                                j === i ? { ...x, end: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label={t('schedule.removeSession')}
                          className="flex size-9 items-center justify-center rounded-sm text-ink-muted hover:bg-surface hover:text-danger"
                          onClick={() =>
                            setDay(d, { sessions: day.sessions.filter((_, j) => j !== i) })
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      {day.sessions.length < SESSIONS_PER_DAY_MAX && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                          onClick={() =>
                            setDay(d, {
                              sessions: [...day.sessions, { start: '17:00', end: '20:00' }],
                            })
                          }
                        >
                          <Plus className="size-4" aria-hidden />
                          {t('schedule.addSession')}
                        </button>
                      )}
                      <label className="flex items-center gap-2 text-sm text-ink-muted">
                        {t('schedule.slotLength')}
                        <select
                          className={cn(inputClass, 'h-9 w-28 rounded-sm px-2 text-sm')}
                          value={day.slotMinutes}
                          onChange={(e) => setDay(d, { slotMinutes: Number(e.target.value) })}
                        >
                          {SLOT_CHOICES.map((m) => (
                            <option key={m} value={m}>
                              {t('schedule.minutes', { n: m })}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <span className="flex min-h-tap items-center text-sm text-ink-muted">
                    {t('schedule.off')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel
        className="mt-4"
        title={t('schedule.windowTitle')}
        description={t('schedule.windowHint')}
      >
        <div className="flex items-center gap-3 p-4">
          <Input
            type="number"
            min={1}
            max={WINDOW_DAYS_MAX}
            aria-label={t('schedule.windowTitle')}
            className="w-28"
            value={state.bookingWindowDays}
            onChange={(e) =>
              edit((s) => ({
                ...s,
                bookingWindowDays: Math.min(
                  WINDOW_DAYS_MAX,
                  Math.max(1, Number(e.target.value) || 1),
                ),
              }))
            }
          />
          <span className="text-sm text-ink-muted">{t('schedule.days')}</span>
        </div>
      </Panel>

      <div className="mt-4 space-y-3">
        {noHours && <p className="text-sm text-warning">{t('schedule.noHoursWarning')}</p>}
        {message && (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}
          >
            {message.text}
          </p>
        )}
        <Button loading={save.isPending} disabled={!dirty && !save.isPending} onClick={submit}>
          {t('schedule.save')}
        </Button>
      </div>
    </>
  );
}

/** A reminder on the clinic dashboard until the weekly hours are set: without them nobody can book. */
export function ScheduleCallout() {
  const t = useT();
  const { unitId } = useClinicUnit();
  const saved = useQuery({
    queryKey: scheduleKey(unitId ?? ''),
    queryFn: () => getSchedule(unitId!),
    enabled: Boolean(unitId),
  });
  if (!unitId || !saved.data || saved.data.weekly.length > 0) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-warning-bg px-4 py-3 text-sm text-warning"
    >
      <span>{t('schedule.callout')}</span>
      <a href="/clinic/schedule" className="font-semibold underline underline-offset-4">
        {t('schedule.setHours')}
      </a>
    </div>
  );
}
