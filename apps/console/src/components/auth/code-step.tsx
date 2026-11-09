'use client';

import { Button } from '@doqto/ui/button';
import { Field, Input } from '@doqto/ui/input';
import type { CodeSentResponse } from '@doqto/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/provider';
import { authErrorKey, resendCode } from '@/lib/auth';

/** The demo code shown only while the API runs in demo mode (nothing is really sent). */
const DEMO_CODE = '123456';

interface Props {
  identifier: string;
  channel: CodeSentResponse['channel'];
  /** Called with the six digits. Throw to show the error under the field. */
  onSubmit: (code: string) => Promise<void>;
  submitLabel: string;
  /** Extra fields shown above the code (for example the new password). */
  children?: ReactNode;
  /** Resend: defaults to the registration code. */
  onResend?: () => Promise<CodeSentResponse>;
  onChannel?: (channel: CodeSentResponse['channel']) => void;
  disabled?: boolean;
  /** Runs before submitting; return false to stop (the caller shows its own message). */
  beforeSubmit?: () => boolean;
}

/** "We sent you a code" step shared by registration, unconfirmed sign-in and password reset. */
export function CodeStep({
  identifier,
  channel,
  onSubmit,
  submitLabel,
  children,
  onResend,
  onChannel,
  disabled,
  beforeSubmit,
}: Props) {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (beforeSubmit && !beforeSubmit()) return;
    if (!/^\d{6}$/.test(code)) {
      setError(t('authError.codeFormat'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(undefined);
    setResent(false);
    try {
      const sent = await (onResend ? onResend() : resendCode(identifier));
      onChannel?.(sent.channel);
      setResent(true);
    } catch (err) {
      setError(t(authErrorKey(err)));
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <p className="text-sm text-ink-muted">{t('code.intro', { to: identifier })}</p>
      {channel === 'demo' && (
        <p role="note" className="rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
          {t('code.demo', { code: DEMO_CODE })}
        </p>
      )}
      {children}
      <Field label={t('code.label')} error={error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        )}
      </Field>
      <Button type="submit" className="w-full" loading={busy} disabled={disabled}>
        {submitLabel}
      </Button>
      <p className="text-center text-sm text-ink-muted" aria-live="polite">
        {resent ? t('code.resent') : t('code.noCode')}{' '}
        <button
          type="button"
          onClick={resend}
          className="font-semibold text-brand-700 underline-offset-4 hover:underline"
        >
          {t('code.resend')}
        </button>
      </p>
    </form>
  );
}
