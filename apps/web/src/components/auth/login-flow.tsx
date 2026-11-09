'use client';

import type { OtpRequestResponse } from '@doqto/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { authApi } from '@/lib/api/lazy';
import { toast } from '@/components/ui/toast';
import { postLoginPath, type LoginAudience } from '@/lib/post-login';
import { meQueryKey } from '@/lib/session';
import { OtpStep } from './otp-step';
import { PhoneStep } from './phone-step';

/**
 * Only same-origin paths are allowed as a post-login redirect. Resolving with `URL` catches the
 * tricks a prefix check misses, like `/\evil.com`, which browsers treat as `//evil.com`.
 */
export function safeNext(next: string | null, origin = window.location.origin): string | null {
  if (!next || !next.startsWith('/')) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    // Dot segments can normalise to `//host` (`/.//evil.com`), which a router reads as another site.
    if (url.pathname.startsWith('//')) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function LoginFlow({
  otpLength,
  audience: audienceProp,
  next: nextProp,
}: {
  otpLength: number;
  /** Where to go after signing in, when the address has no `?next=` (the login dialog). */
  next?: string;
  /** `clinic` for the doctor and staff sign-in; read from `?audience=clinic` when not given. */
  audience?: LoginAudience;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { locale, setLocale, t } = useI18n();
  const audience: LoginAudience =
    audienceProp ?? (params.get('audience') === 'clinic' ? 'clinic' : 'patient');
  const [lastPhone, setLastPhone] = useState<string>();
  const [sent, setSent] = useState<{
    phone: string;
    whatsappOptIn: boolean;
    otp: OtpRequestResponse;
    at: number;
  } | null>(null);

  if (!sent) {
    return (
      <PhoneStep
        initialPhone={lastPhone}
        audience={audience}
        onSent={(phone, whatsappOptIn, otp) => {
          setLastPhone(phone);
          setSent({ phone, whatsappOptIn, otp, at: Date.now() });
        }}
      />
    );
  }

  return (
    <OtpStep
      otpLength={otpLength}
      phone={sent.phone}
      whatsappOptIn={sent.whatsappOptIn}
      otp={sent.otp}
      sentAt={sent.at}
      onResent={(otp) => setSent({ ...sent, otp, at: Date.now() })}
      onChangeNumber={() => setSent(null)}
      onVerified={async ({ user, isNewUser }) => {
        let me = user;
        if (isNewUser && user.language !== locale) {
          // Keep the language the person chose before signing up.
          me = await authApi.updateMe({ language: locale }).catch(() => user);
        } else if (!isNewUser && user.language !== locale) {
          setLocale(user.language);
        }
        qc.setQueryData(meQueryKey, me);
        const { path, denied } = postLoginPath({
          roles: me.roles,
          isNewUser,
          next: safeNext(params.get('next') ?? nextProp ?? null),
          audience,
        });
        if (denied) toast.error(t('auth.notConsoleAccount'));
        router.replace(path);
      }}
    />
  );
}
