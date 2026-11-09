'use client';

import { OTP_LENGTH } from '@doqto/shared';
import Link from 'next/link';
import { LoginModal } from '@/components/auth/login-modal';
import { usePwaInstall } from '@/lib/pwa-install';
import { useMe } from '@/lib/session';

/**
 * The navbar's main button: installs the app with one tap where the browser allows it, otherwise
 * opens the install page. Once Doqto is installed there is nothing left to install, so it goes
 * back to being a "Find a doctor" button.
 */
export function NavInstall({
  installLabel,
  findLabel,
  className,
  onDone,
}: {
  installLabel: string;
  findLabel: string;
  className?: string;
  onDone?: () => void;
}) {
  const install = usePwaInstall();
  const me = useMe();
  if (install.installed) {
    // Doctors are for signed-in patients only: a guest signs in first and lands on the search.
    if (!me.data) {
      return (
        <LoginModal otpLength={OTP_LENGTH} next="/search" className={className}>
          {findLabel}
        </LoginModal>
      );
    }
    return (
      <Link href="/search" className={className} onClick={onDone}>
        {findLabel}
      </Link>
    );
  }
  if (install.canPrompt) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          void install.prompt();
          onDone?.();
        }}
      >
        {installLabel}
      </button>
    );
  }
  return (
    <Link href="/install" className={className} onClick={onDone}>
      {installLabel}
    </Link>
  );
}
