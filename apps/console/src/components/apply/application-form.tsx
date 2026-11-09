'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Checkbox } from '@doqto/ui/checkbox';
import { cn } from '@doqto/ui/cn';
import { Field, Input, Textarea, inputClass } from '@doqto/ui/input';
import { Logo } from '@doqto/ui/logo';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import {
  SPECIALTIES,
  UNIT_FORMS,
  WORKSPACE_TYPES,
  checkUnitProfile,
  type FormField,
  type Workspace,
  type WorkspaceType,
} from '@doqto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { useI18n } from '@/i18n/provider';
import { loginPath, servicesPath } from '@/lib/app-config';
import { applyForServices, authErrorKey, getMe, getWorkspace, meKey } from '@/lib/auth';

const ICONS: Record<WorkspaceType, LucideIcon> = {
  clinic: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
};

export type Values = Record<string, string | boolean>;
type Errors = Record<string, string>; // "lab.registrationNumber" -> message

/** Services that can still be applied for: not applied yet, saved only, or sent back for changes. */
function applicable(workspaces: readonly Workspace[]): WorkspaceType[] {
  const byKind = new Map(workspaces.map((w) => [w.kind, w]));
  return WORKSPACE_TYPES.filter((k) => {
    const w = byKind.get(k);
    return !w || w.status === 'draft' || w.status === 'changes_requested';
  });
}

/** Text boxes hold strings; the API wants numbers and booleans, so convert on the way out. */
export function toProfile(kind: WorkspaceType, values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of UNIT_FORMS[kind]) {
    const v = values[f.key];
    if (f.type === 'boolean') out[f.key] = v === true;
    else if (f.type === 'number') {
      if (typeof v === 'string' && v.trim() !== '') out[f.key] = Number(v);
    } else if (typeof v === 'string') out[f.key] = v;
  }
  return out;
}

export function fromProfile(kind: WorkspaceType, profile: Record<string, unknown>): Values {
  const out: Values = {};
  for (const f of UNIT_FORMS[kind]) {
    const v = profile[f.key];
    if (f.type === 'boolean') out[f.key] = v === true;
    else if (v !== undefined && v !== null) out[f.key] = String(v);
  }
  return out;
}

/**
 * The one application form. The person ticks the services they run, and a section appears for each
 * with the fields that service needs (from `UNIT_FORMS`, the same list the API checks). Submitting
 * sends every section together; Doqto reviews each service on its own. The same page is used the
 * first time and later, from Settings, to add more services or to fix one sent back for changes.
 */
export function ApplicationForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const account = me.data;

  // `?kind=lab` opens the form with that service ticked (used by "Update application").
  const preselected = params.get('kind');
  const [picked, setPicked] = useState<WorkspaceType[]>(() =>
    (WORKSPACE_TYPES as readonly string[]).includes(preselected ?? '') ? [preselected as WorkspaceType] : [],
  );
  const [values, setValues] = useState<Record<WorkspaceType, Values>>({
    clinic: {},
    lab: {},
    pharmacy: {},
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();

  useEffect(() => {
    if (me.isError && isApiError(me.error) && me.error.status === 401) router.replace(loginPath);
  }, [me.isError, me.error, router]);

  const open = useMemo(() => (account ? applicable(account.workspaces) : []), [account]);

  // Only services that can still be applied for count, whatever was ticked or preselected.
  const selected = picked.filter((k) => open.includes(k));

  // A service sent back for changes comes with the answers already given.
  const sentBack = account?.workspaces.filter((w) => w.status === 'changes_requested' || w.status === 'draft') ?? [];
  const sentBackKey = sentBack.map((w) => w.id).join(',');
  useEffect(() => {
    let live = true;
    void Promise.all(sentBack.map((w) => getWorkspace(w.id))).then((details) => {
      if (!live) return;
      setValues((cur) => {
        const next = { ...cur };
        for (const d of details) next[d.kind] = { ...fromProfile(d.kind, d.profile), ...cur[d.kind] };
        return next;
      });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentBackKey]);

  const sentBackNote = (kind: WorkspaceType) =>
    sentBack.find((w) => w.kind === kind && w.status === 'changes_requested')?.reviewNote ?? undefined;

  const submit = useMutation({
    mutationFn: () =>
      applyForServices(selected.map((kind) => ({ kind, profile: toProfile(kind, values[kind]) }))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meKey });
      router.push(servicesPath);
    },
    onError: (err) => {
      const issues = isApiError(err) && Array.isArray(err.details.issues) ? err.details.issues : [];
      if (issues.length > 0) {
        setErrors(Object.fromEntries((issues as { path: string }[]).map((i) => [i.path, t('apply.invalid')])));
        setFormError(t('apply.fixErrors'));
      } else setFormError(t(authErrorKey(err)));
    },
  });

  function toggle(kind: WorkspaceType) {
    setPicked((cur) => (cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    for (const kind of selected) {
      const profile = toProfile(kind, values[kind]);
      const res = checkUnitProfile(kind, profile);
      if (!res.ok) {
        for (const i of res.issues) {
          const given = profile[i.path];
          next[`${kind}.${i.path}`] = given === undefined || given === '' ? t('apply.required') : t('apply.invalid');
        }
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFormError(t('apply.fixErrors'));
      return;
    }
    setFormError(undefined);
    submit.mutate();
  }


  if (!account) {
    return (
      <p role="status" className="p-6 text-sm text-ink-muted">
        {me.isError && !(isApiError(me.error) && me.error.status === 401)
          ? t('common.somethingWrong')
          : t('common.loading')}
      </p>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href={servicesPath} aria-label={t('common.appName')}>
          <Logo />
        </Link>
        <LanguageSwitch />
      </header>
      <PageHeader title={t('apply.title')} description={t('apply.intro')} />

      {open.length === 0 ? (
        <Panel>
          <p className="p-4 text-sm text-ink-muted">{t('apply.nothingLeft')}</p>
        </Panel>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t('apply.choose')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {open.map((kind) => {
                const Icon = ICONS[kind];
                const on = selected.includes(kind);
                return (
                  <label
                    key={kind}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-sm border bg-white p-3 transition-colors',
                      on ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line hover:border-ink-muted',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(kind)}
                      className="sr-only"
                    />
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {t(('workspaceTypes.' + kind) as Parameters<typeof t>[0])}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selected.length === 0 && <p className="text-sm text-ink-muted">{t('apply.chooseHint')}</p>}

          {WORKSPACE_TYPES.filter((k) => selected.includes(k)).map((kind) => (
            <Panel
              key={kind}
              title={t(('apply.section.' + kind) as Parameters<typeof t>[0])}
              description={t('apply.sectionHint')}
            >
              {sentBackNote(kind) && (
                <p role="note" className="mx-4 mt-4 rounded-sm bg-warning-bg px-3 py-2 text-sm text-ink">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-warning">
                    {t('panel.noteFromDoqto')}
                  </span>
                  {sentBackNote(kind)}
                </p>
              )}
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {UNIT_FORMS[kind].map((f) => (
                  <FormFieldInput
                    key={f.key}
                    kind={kind}
                    field={f}
                    locale={locale}
                    value={values[kind][f.key]}
                    error={errors[`${kind}.${f.key}`]}
                    onChange={(v) => {
                      setValues((cur) => ({ ...cur, [kind]: { ...cur[kind], [f.key]: v } }));
                      setFormError(undefined);
                      setErrors((cur) => {
                        const { [`${kind}.${f.key}`]: _gone, ...rest } = cur;
                        return rest;
                      });
                    }}
                  />
                ))}
              </div>
            </Panel>
          ))}

          {selected.length > 0 && (
            <div className="space-y-3">
              {formError && (
                <p role="alert" className="text-sm text-danger">
                  {formError}
                </p>
              )}
              <p className="text-sm text-ink-muted">{t('apply.afterSubmit')}</p>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={submit.isPending}>
                  {t('apply.submit')}
                </Button>
                <Link
                  href={servicesPath}
                  className="inline-flex h-tap items-center px-4 text-sm font-semibold text-brand-700"
                >
                  {t('apply.cancel')}
                </Link>
              </div>
            </div>
          )}
        </form>
      )}
    </main>
  );
}

export function FormFieldInput({
  kind,
  field,
  locale,
  value,
  error,
  onChange,
}: {
  kind: WorkspaceType;
  field: FormField;
  locale: 'en' | 'hi';
  value: string | boolean | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
}) {
  const { t } = useI18n();
  const label = t(('form.' + kind + '.' + field.key) as Parameters<typeof t>[0]);
  const wide = field.type === 'textarea';
  const optional = field.required ? '' : ` (${t('apply.optional')})`;

  if (field.type === 'boolean') {
    return (
      <div className={cn(wide && 'sm:col-span-2')}>
        <Checkbox label={label} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      </div>
    );
  }

  return (
    <Field label={label + optional} error={error} className={cn(wide && 'sm:col-span-2')}>
      {({ id, describedBy, invalid }) => {
        const common = { id, 'aria-describedby': describedBy, 'aria-invalid': invalid };
        if (field.type === 'textarea') {
          return (
            <Textarea
              {...common}
              maxLength={field.maxLength}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        }
        if (field.type === 'select') {
          return (
            <select
              {...common}
              className={cn(inputClass, 'pr-8')}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">{t('apply.choosePlaceholder')}</option>
              {SPECIALTIES.filter((s) => field.options?.includes(s.key)).map((s) => (
                <option key={s.key} value={s.key}>
                  {s[locale]}
                </option>
              ))}
            </select>
          );
        }
        return (
          <Input
            {...common}
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            inputMode={field.type === 'number' ? 'numeric' : undefined}
            min={field.min}
            max={field.max}
            maxLength={field.maxLength}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }}
    </Field>
  );
}
