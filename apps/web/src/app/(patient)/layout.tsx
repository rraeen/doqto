import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { PatientNav } from '@/components/shell/navs';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader right={<LanguageSwitch />} />
      {children}
      <PatientNav />
    </>
  );
}
