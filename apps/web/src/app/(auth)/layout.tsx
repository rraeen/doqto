import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader right={<LanguageSwitch compact />} />
      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-8">
        {children}
      </div>
    </div>
  );
}
