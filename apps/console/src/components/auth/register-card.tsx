'use client';

import { Button } from '@doqto/ui/button';
import { Field, Input } from '@doqto/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import type { CodeSentResponse } from '@doqto/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n/provider';
import { loginPath } from '@/lib/app-config';
import { env } from '@/lib/env';
import {
  authErrorKey,
  isStrongPassword,
  isValidIdentifier,
  landingForAccount,
  meKey,
  normalizeIdentifier,
  registerAccount,
  verifyAccount,
} from '@/lib/auth';
import { AuthFrame } from './auth-frame';
import { CodeStep } from './code-step';

type Errors = Partial<Record<'name' | 'identifier' | 'password' | 'form', string>>;

/**
 * Register in two steps: name and sign-in details, then the code sent to the phone or email,
 * which confirms it once. Nothing about services is asked here; after signing in the person chooses
 * what they run (clinic, lab, pharmacy) on the services panel.
 */
export function RegisterCard() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ identifier: string; channel: CodeSentResponse['channel'] }>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeIdentifier(identifier);
    const next: Errors = {};
    if (name.trim().length < 2) next.name = t('register.errName');
    if (!isValidIdentifier(normalized)) next.identifier = t('register.errIdentifier');
    if (!isStrongPassword(password)) next.password = t('register.errPassword');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const res = await registerAccount({
        name: name.trim(),
        identifier: normalized,
        password,
        language: locale,
      });
      setSent({ identifier: normalized, channel: res.channel });
    } catch (err) {
      const key = authErrorKey(err);
      setErrors(
        key === 'authError.exists' ? { identifier: t(key) } : { form: t(key) },
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string) {
    if (!sent) return;
    const session = await verifyAccount(sent.identifier, code);
    queryClient.setQueryData(meKey, session.account);
    router.replace(landingForAccount(session.account));
  }

  if (sent) {
    return (
      <AuthFrame>
        <h1 className="text-2xl font-bold text-ink">{t('code.title')}</h1>
        <div className="mt-4">
          <CodeStep
            identifier={sent.identifier}
            channel={sent.channel}
            onSubmit={confirm}
            submitLabel={t('code.confirm')}
            onChannel={(channel) => setSent({ ...sent, channel })}
          />
        </div>
        <p className="mt-6 text-center text-sm">
          <button
            type="button"
            onClick={() => setSent(undefined)}
            className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            {t('code.change')}
          </button>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-bold text-ink">{t('register.title')}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t('register.intro')}</p>

      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <Field label={t('register.name')} error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="name"
              value={name}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={t('register.identifier')}
          hint={t('register.identifierHint')}
          error={errors.identifier}
        >
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
        <Field label={t('register.password')} error={errors.password}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              aria-describedby={describedBy}
              aria-invalid={invalid}
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
          {t('register.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('register.haveAccount')}{' '}
        <Link
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          href={loginPath}
        >
          {t('register.signIn')}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-ink-muted">
        {t('register.patientHint')}{' '}
        <a
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
          href={env.siteUrl}
        >
          {t('register.patientLink')}
        </a>
      </p>
    </AuthFrame>
  );
}
