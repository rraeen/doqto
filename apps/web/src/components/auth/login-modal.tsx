'use client';

import { useState, type ReactNode } from 'react';
import { Suspense } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { useT } from '@/i18n/provider';
import { LoginFlow } from './login-flow';

/**
 * Patient sign-in as a dialog over the landing page. Same `LoginFlow` as `/login`, which stays for
 * shareable links and `?next=`. After a successful verify the flow navigates, which closes this.
 */
export function LoginModal({
  otpLength,
  className,
  next,
  children,
}: {
  otpLength: number;
  className?: string;
  /** Page to open after signing in, e.g. `/search` for "Find a doctor". */
  next?: string;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t('landing.login')}
      closeLabel={t('common.close')}
      trigger={
        <button type="button" className={className}>
          {children}
        </button>
      }
    >
      <div className="pb-2 text-center">
        <Suspense>
          <LoginFlow otpLength={otpLength} audience="patient" next={next} />
        </Suspense>
      </div>
    </Sheet>
  );
}
