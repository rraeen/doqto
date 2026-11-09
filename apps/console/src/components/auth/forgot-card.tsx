'use client';

import { Button } from '@doqto/ui/button';
import { Field, Input } from '@doqto/ui/input';
import type { CodeSentResponse } from '@doqto/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useT } from '@/i18n/provider';
import { loginPath } from '@/lib/app-config';
import {
  authErrorKey,
  forgotPassword,
  isStrongPassword,
  isValidIdentifier,
  normalizeIdentifier,
  resetPassword,
} from '@/lib/auth';
import { AuthFrame } from './auth-frame';
import { CodeStep } from './code-step';

type Step =
  | { name: 'ask' }
  | { name: 'reset'; identifier: string; channel: CodeSentResponse['channel'] }
  | { name: 'done' };

/**
 * Forgotten password: say which phone or email, get a code, choose a new password. Resetting
 * signs the account out on every device. The reply is the same whether or not the account exists.
 */
export function ForgotCard() {
  const t = useT();
  const [step, setStep] = useState<Step>({ name: 'ask' });
  const [identifier, setIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeIdentifier(identifier);
    if (!isValidIdentifier(normalized)) {
      setError(t('register.errIdentifier'));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const sent = await forgotPassword(normalized);
      setStep({ name: 'reset', identifier: normalized, channel: sent.channel });
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  function passwordOk(): boolean {
    const ok = isStrongPassword(newPassword);
    setPasswordError(ok ? undefined : t('register.errPassword'));
    return ok;
  }

  async function reset(code: string) {
    if (step.name !== 'reset') return;
    await resetPassword({ identifier: step.identifier, code, newPassword });
    setStep({ name: 'done' });
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-bold text-ink">{t('forgot.title')}</h1>

      {step.name === 'ask' && (
        <>
          <p className="mt-1 text-sm text-ink-muted">{t('forgot.intro')}</p>
          <form className="mt-5 space-y-4" onSubmit={ask} noValidate>
            <Field label={t('login.identifier')} error={error}>
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
            <Button type="submit" className="w-full" loading={busy}>
              {t('forgot.send')}
            </Button>
          </form>
        </>
      )}

      {step.name === 'reset' && (
        <div className="mt-4">
          <CodeStep
            identifier={step.identifier}
            channel={step.channel}
            submitLabel={t('forgot.submit')}
            onSubmit={reset}
            beforeSubmit={passwordOk}
            onResend={() => forgotPassword(step.identifier)}
            onChannel={(channel) => setStep({ ...step, channel })}
          >
            <Field label={t('forgot.newPassword')} hint={t('forgot.passwordHint')} error={passwordError}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              )}
            </Field>
          </CodeStep>
        </div>
      )}

      {step.name === 'done' && (
        <div className="mt-4 space-y-4">
          <p role="status" className="rounded-sm bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {t('forgot.done')}
          </p>
          <Link href={loginPath} className="block text-center font-semibold text-brand-700 underline-offset-4 hover:underline">
            {t('forgot.toLogin')}
          </Link>
        </div>
      )}

      {step.name !== 'done' && (
        <p className="mt-6 text-center text-sm">
          <Link
            className="font-semibold text-brand-700 underline-offset-4 hover:underline"
            href={loginPath}
          >
            {t('forgot.back')}
          </Link>
        </p>
      )}
    </AuthFrame>
  );
}

