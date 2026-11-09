'use client';

import type { OtpRequestResponse } from '@doqto/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { useT } from '@/i18n/provider';
import { authApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';

interface PhoneStepProps {
  /** E.164 number to start from, e.g. after "Change number". */
  initialPhone?: string;
  onSent: (phone: string, whatsappOptIn: boolean, otp: OtpRequestResponse) => void;
  audience?: 'patient' | 'clinic';
}

export function PhoneStep({ initialPhone, onSent, audience = 'patient' }: PhoneStepProps) {
  const t = useT();
  const [phone, setPhone] = useState<string | null>(initialPhone ?? null);
  const [consent, setConsent] = useState(true);
  const [touched, setTouched] = useState(false);
  const send = useMutation({
    mutationFn: authApi.requestOtp,
    onSuccess: (otp, sentTo) => onSent(sentTo, consent, otp),
  });

  const showInvalid = touched && !phone;
  const error = showInvalid
    ? t('auth.phoneInvalid')
    : send.error
      ? authErrorMessage(send.error, t)
      : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (phone) send.mutate(phone);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-8 text-left">
      <div className="text-center">
        <PageTitle
          description={t(audience === 'clinic' ? 'auth.consoleSubtitle' : 'auth.phoneSubtitle')}
        >
          {t(audience === 'clinic' ? 'auth.consoleTitle' : 'auth.phoneTitle')}
        </PageTitle>
      </div>
      <Field label={t('auth.phoneLabel')} error={error}>
        {({ id, describedBy, invalid }) => (
          <PhoneInput
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            autoFocus
            defaultDigits={initialPhone?.slice(3)}
            onValueChange={(e164, d) => {
              setPhone(e164);
              if (d.length === 10) setTouched(true);
              send.reset();
            }}
          />
        )}
      </Field>
      <Checkbox
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        label={t('auth.whatsappConsent')}
      />
      <Button type="submit" size="lg" loading={send.isPending}>
        {t('auth.sendCode')}
      </Button>
    </form>
  );
}
