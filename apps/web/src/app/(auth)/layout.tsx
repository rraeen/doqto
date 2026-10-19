import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader right={<LanguageSwitch />} />
      {children}
    </>
  );
}
