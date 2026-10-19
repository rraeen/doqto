'use client';

import type { OtpRequestResponse, OtpVerifyResponse } from '@doqto/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { authApi } from '@/lib/api/lazy';
import { isApiError } from '@/lib/api/errors';
import { authErrorMessage } from '@/lib/api/messages';
import { DEMO_OTP_CODE } from '@/lib/demo';
import { getInstallId } from '@/lib/install-id';
import { formatE164ForDisplay } from '@/lib/phone';

export const RESEND_AFTER_SECONDS = 30;

interface OtpStepProps {
  /** `otpLength` from the contract, passed down from the server page to keep Zod out of the bundle. */
  otpLength: number;
  phone: string;
  whatsappOptIn: boolean;
  otp: OtpRequestResponse;
  sentAt: number;
  onResent: (otp: OtpRequestResponse) => void;
  onChangeNumber: () => void;
  onVerified: (res: OtpVerifyResponse) => Promise<void>;
}

function useSecondsLeft(from: number, total: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.min(total, Math.max(0, total - Math.floor((now - from) / 1000)));
}

export function OtpStep({
  otpLength,
  phone,
  whatsappOptIn,
  otp,
  sentAt,
  onResent,
  onChangeNumber,
  onVerified,
}: OtpStepProps) {
  const t = useT();
  const [code, setCode] = useState('');
  const resendIn = useSecondsLeft(sentAt, RESEND_AFTER_SECONDS);

  const verify = useMutation({
    mutationFn: (value: string) =>
      authApi.verifyOtp({ phone, code: value, whatsappOptIn, deviceId: getInstallId() }),
    onSuccess: onVerified,
    onError: () => setCode(''),
  });
  const resend = useMutation({
    mutationFn: () => authApi.requestOtp(phone),
    onSuccess: (next) => {
      verify.reset();
      setCode('');
      onResent(next);
      toast.success(t('auth.codeResent'));
    },
  });

  // Locked or expired codes cannot be retried; only a new code helps.
  const needsNewCode =
    isApiError(verify.error, 'OTP_LOCKED') || isApiError(verify.error, 'OTP_EXPIRED');
  const error = verify.error
    ? authErrorMessage(verify.error, t)
    : resend.error
      ? authErrorMessage(resend.error, t)
      : undefined;
  const busy = verify.isPending || verify.isSuccess;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === otpLength && !needsNewCode) verify.mutate(code);
      }}
    >
      <PageTitle description={t('auth.otpSubtitle', { phone: formatE164ForDisplay(phone) })}>
        {t('auth.otpTitle')}
      </PageTitle>

      {otp.channel === 'demo' && (
        <p
          role="note"
          className="rounded-md bg-warning-bg px-3 py-2 text-sm font-medium text-warning"
        >
          {t('auth.demoHint', { code: DEMO_OTP_CODE })}
        </p>
      )}

      <Field label={t('auth.otpLabel')} error={error}>
        {({ describedBy, invalid }) => (
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (verify.isError && !needsNewCode) verify.reset();
            }}
            onComplete={(v) => {
              if (!needsNewCode) verify.mutate(v);
            }}
            length={otpLength}
            invalid={invalid}
            disabled={busy || needsNewCode}
            autoFocus
            digitLabel={(n) => t('auth.digitLabel', { n })}
            aria-label={t('auth.otpLabel')}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={busy}
        disabled={code.length !== otpLength || needsNewCode}
      >
        {t('auth.verify')}
      </Button>

      <div className="flex items-center justify-between gap-4 text-sm">
        <Button type="button" variant="link" onClick={onChangeNumber} disabled={busy}>
          {t('auth.changeNumber')}
        </Button>
        {resendIn > 0 && !needsNewCode ? (
          <span className="text-ink-muted" aria-live="polite">
            {t('auth.resendIn', { seconds: resendIn })}
          </span>
        ) : (
          <Button
            type="button"
            variant="link"
            onClick={() => resend.mutate()}
            loading={resend.isPending}
            disabled={busy}
          >
            {t('auth.resend')}
          </Button>
        )}
      </div>
    </form>
  );
}
