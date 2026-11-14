'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Field, Input } from '@doqto/ui/input';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '@/i18n/provider';
import { loginPath } from '@/lib/app-config';
import {
  authErrorKey,
  changePassword,
  getMe,
  isStrongPassword,
  landingForAccount,
  meKey,
} from '@/lib/auth';
import { AuthFrame } from './auth-frame';

/**
 * A staff member signs in with the temporary password the owner set, and must choose their own
 * before anything else. The same screen works for anyone who wants to change their password.
 */
export function ChangePasswordCard() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: getMe, retry: false });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const signedOut = me.isError && isApiError(me.error) && me.error.status === 401;
  useEffect(() => {
    if (signedOut) router.replace(loginPath);
  }, [signedOut, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = t('changePassword.errCurrent');
    if (!isStrongPassword(next)) found.next = t('changePassword.errNext');
    else if (next === current) found.next = t('changePassword.errSame');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      const account = await queryClient.fetchQuery({ queryKey: meKey, queryFn: getMe, staleTime: 0 });
      router.replace(landingForAccount(account));
    } catch (err) {
      setErrors({
        form: isApiError(err, 'INVALID_CREDENTIALS')
          ? t('changePassword.errWrong')
          : t(authErrorKey(err)),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-bold text-ink">{t('changePassword.title')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t('changePassword.intro')}</p>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field label={t('changePassword.current')} error={errors.current}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('changePassword.next')} error={errors.next}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={next}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setNext(e.target.value)}
            />
          )}
        </Field>
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          {t('changePassword.submit')}
        </Button>
      </form>
    </AuthFrame>
  );
}
