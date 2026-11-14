'use client';

import { isApiError } from '@doqto/api-client';
import { PERMISSIONS_BY_KIND, USERNAME_REGEX, type StaffMember } from '@doqto/shared';
import { Button } from '@doqto/ui/button';
import { Checkbox } from '@doqto/ui/checkbox';
import { EmptyState } from '@doqto/ui/empty-state';
import { Field, Input } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import type { WorkspaceType } from '@/lib/app-config';
import {
  authErrorKey,
  createStaff,
  getMe,
  getStaff,
  isStrongPassword,
  meKey,
  removeStaff,
  resetStaffPassword,
  staffKey,
  updateStaff,
} from '@/lib/auth';

type Message = { ok: boolean; text: string };

/** The permission checkboxes for this kind of service. */
function PermissionPicker({
  type,
  value,
  onChange,
}: {
  type: WorkspaceType;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-medium text-ink">{t('staff.permissions')}</legend>
      {PERMISSIONS_BY_KIND[type].map((p) => (
        <Checkbox
          key={p}
          checked={value.includes(p)}
          onChange={(e) =>
            onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))
          }
          label={t(('staff.perm.' + p) as Parameters<typeof t>[0])}
        />
      ))}
    </fieldset>
  );
}

/** Why a staff request failed, in the person's language. */
function useErrorText() {
  const t = useT();
  return (err: unknown): string => {
    if (isApiError(err, 'CONFLICT')) {
      return /taken/i.test(err.message) ? t('staff.taken') : t('staff.already');
    }
    if (isApiError(err, 'FORBIDDEN')) return t('staff.ownerOnly');
    return t(authErrorKey(err));
  };
}

function AddStaff({
  type,
  unitId,
  onDone,
}: {
  type: WorkspaceType;
  unitId: string;
  onDone: (m: Message) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string; username?: string; password?: string; form?: string }>({});

  const create = useMutation({
    mutationFn: () =>
      createStaff(unitId, { name: name.trim(), username: username.trim().toLowerCase(), password, permissions }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffKey(unitId) });
      setOpen(false);
      setName('');
      setUsername('');
      setPassword('');
      setPermissions([]);
      onDone({ ok: true, text: t('staff.created') });
    },
    onError: (err) => setErrors({ form: errorText(err) }),
  });

  function submit() {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = t('staff.errName');
    if (!USERNAME_REGEX.test(username.trim().toLowerCase())) next.username = t('staff.errUsername');
    if (!isStrongPassword(password)) next.password = t('staff.errPassword');
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t('staff.add')}</Button>;
  }
  return (
    <Panel title={t('staff.add')} className="mb-4">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Field label={t('staff.name')} error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={name}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('staff.username')} hint={t('staff.usernameHint')} error={errors.username}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="off"
              autoCapitalize="none"
              value={username}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={t('staff.password')}
          hint={t('staff.passwordHint')}
          error={errors.password}
          className="sm:col-span-2"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="text"
              autoComplete="off"
              value={password}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <PermissionPicker type={type} value={permissions} onChange={setPermissions} />
        </div>
        {errors.form && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {errors.form}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            {t('staff.create')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t('staff.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function StaffRow({
  type,
  unitId,
  member,
  onDone,
}: {
  type: WorkspaceType;
  unitId: string;
  member: StaffMember;
  onDone: (m: Message) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [mode, setMode] = useState<'view' | 'access' | 'password'>('view');
  const [permissions, setPermissions] = useState(member.permissions);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: staffKey(unitId) });
  const fail = (err: unknown) => setError(errorText(err));

  const save = useMutation({
    mutationFn: () => updateStaff(unitId, member.accountId, { permissions }),
    onSuccess: async () => {
      await refresh();
      setMode('view');
      onDone({ ok: true, text: t('staff.updated') });
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: () => resetStaffPassword(unitId, member.accountId, password),
    onSuccess: () => {
      setMode('view');
      setPassword('');
      onDone({ ok: true, text: t('staff.passwordReset') });
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => removeStaff(unitId, member.accountId),
    onSuccess: async () => {
      await refresh();
      onDone({ ok: true, text: t('staff.removed') });
    },
    onError: fail,
  });

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{member.name}</p>
          <p className="text-sm text-ink-muted">@{member.username}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {member.mustChangePassword && (
              <StatusChip tone="warning">{t('staff.mustChange')}</StatusChip>
            )}
            {member.status === 'suspended' && (
              <StatusChip tone="danger">{t('staff.suspended')}</StatusChip>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {member.permissions.length === 0
              ? t('staff.permissionsNone')
              : member.permissions
                  .map((p) => t(('staff.perm.' + p) as Parameters<typeof t>[0]).split(':')[0])
                  .join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'access' ? 'view' : 'access')}>
            {t('staff.edit')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'password' ? 'view' : 'password')}>
            {t('staff.resetPassword')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm(t('staff.removeConfirm', { name: member.name }))) remove.mutate();
            }}
          >
            {t('staff.remove')}
          </Button>
        </div>
      </div>

      {mode === 'access' && (
        <div className="space-y-3 rounded-sm border border-line p-3">
          <PermissionPicker type={type} value={permissions} onChange={setPermissions} />
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            {t('staff.save')}
          </Button>
        </div>
      )}
      {mode === 'password' && (
        <form
          className="space-y-3 rounded-sm border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isStrongPassword(password)) setError(t('staff.errPassword'));
            else reset.mutate();
          }}
        >
          <Field label={t('staff.newPassword')} hint={t('staff.passwordHint')}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                autoComplete="off"
                value={password}
                aria-describedby={describedBy}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button size="sm" type="submit" loading={reset.isPending}>
            {t('staff.save')}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * The owner's staff for one service: add a login (username and a temporary password), pick exactly
 * what the person can use, change it later, reset the password or remove them. Staff cannot reach
 * this screen; the API refuses them too.
 */
export function StaffScreen({ type }: { type: WorkspaceType }) {
  const t = useT();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const unit = me.data?.workspaces.find((w) => w.kind === type && w.status === 'verified');
  const unitId = unit?.id;
  const list = useQuery({
    queryKey: staffKey(unitId ?? ''),
    queryFn: () => getStaff(unitId!),
    enabled: Boolean(unitId) && unit?.role === 'owner',
  });
  const [message, setMessage] = useState<Message>();

  return (
    <>
      <PageHeader title={t('staff.title')} description={t('staff.intro')} />
      {message && (
        <p role="status" className={message.ok ? 'mb-4 text-sm text-success' : 'mb-4 text-sm text-danger'}>
          {message.text}
        </p>
      )}
      {unitId && (
        <>
          <div className="mb-4">
            <AddStaff type={type} unitId={unitId} onDone={setMessage} />
          </div>
          <Panel>
            {list.isPending ? (
              <p role="status" className="text-sm text-ink-muted">
                {t('common.loading')}
              </p>
            ) : list.isError ? (
              <p role="alert" className="text-sm text-danger">
                {t('common.somethingWrong')}
              </p>
            ) : list.data.items.length === 0 ? (
              <EmptyState icon={Users} title={t('staff.empty')} />
            ) : (
              <ul className="divide-y divide-line">
                {list.data.items.map((m) => (
                  <StaffRow
                    key={m.accountId}
                    type={type}
                    unitId={unitId}
                    member={m}
                    onDone={setMessage}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
