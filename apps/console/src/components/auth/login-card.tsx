'use client';

import { isApiError } from '@doqto/api-client';
import { Button } from '@doqto/ui/button';
import { Field, Input } from '@doqto/ui/input';
import type { CodeSentResponse } from '@doqto/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useT } from '@/i18n/provider';
import { registerPath } from '@/lib/app-config';
import { env } from '@/lib/env';
import {
  authErrorKey,
  isValidLoginIdentifier,
  landingForAccount,
  login,
  meKey,
  normalizeIdentifier,
  resendCode,
  verifyAccount,
} from '@/lib/auth';
import { AuthFrame } from './auth-frame';
import { CodeStep } from './code-step';

/**
 * Sign in with a phone or email and a password: no code at each sign-in. The one exception is an
 * account that registered but never confirmed its phone or email; it is asked for the code once.
 */
export function LoginCard() {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    identifier: string;
    channel: CodeSentResponse['channel'];
  }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeIdentifier(identifier);
    if (!isValidLoginIdentifier(normalized)) {
      setErrors({ identifier: t('register.errIdentifier') });
      return;
    }
    if (!password) {
      setErrors({ form: t('login.errPassword') });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const session = await login(normalized, password);
      queryClient.setQueryData(meKey, session.account);
      router.replace(landingForAccount(session.account));
    } catch (err) {
      if (isApiError(err, 'CONTACT_NOT_VERIFIED')) {
        // The password was right but the phone or email was never confirmed: send a code now.
        try {
          const sent = await resendCode(normalized);
          setConfirm({ identifier: normalized, channel: sent.channel });
        } catch (sendErr) {
          setErrors({ form: t(authErrorKey(sendErr)) });
        }
      } else {
        setErrors({ form: t(authErrorKey(err)) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(code: string) {
    if (!confirm) return;
    const session = await verifyAccount(confirm.identifier, code);
    queryClient.setQueryData(meKey, session.account);
    router.replace(landingForAccount(session.account));
  }

  if (confirm) {
    return (
      <AuthFrame>
        <h1 className="text-2xl font-bold text-ink">{t('code.title')}</h1>
        <div className="mt-4">
          <CodeStep
            identifier={confirm.identifier}
            channel={confirm.channel}
            onSubmit={confirmCode}
            submitLabel={t('code.confirm')}
            onChannel={(channel) => setConfirm({ ...confirm, channel })}
          />
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-bold text-ink">{t('login.title')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t('login.intro')}</p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field label={t('login.identifier')} error={errors.identifier}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="username"
              value={identifier}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('login.password')}>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          {t('login.submit')}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          href="/forgot-password"
        >
          {t('login.forgot')}
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-ink-muted">
        {t('login.registerHint')}{' '}
        <Link
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          href={registerPath}
        >
          {t('login.registerLink')}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-muted">
        {t('login.patientHint')}{' '}
        <a
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          href={env.siteUrl}
        >
          {t('login.patientLink')}
        </a>
      </p>
    </AuthFrame>
  );
}
