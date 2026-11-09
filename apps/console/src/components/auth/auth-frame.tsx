import { Logo } from '@doqto/ui/logo';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LanguageSwitch } from '../shell/language-switch';

/** The centred card shared by sign-in and register. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="neu-surface flex min-h-dvh items-center justify-center p-4">
      <div className="neu-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Doqto Console">
            <Logo />
          </Link>
          <LanguageSwitch />
        </div>
        {children}
      </div>
    </main>
  );
}
