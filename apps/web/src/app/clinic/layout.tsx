import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { ClinicNav } from '@/components/shell/navs';
import { Badge } from '@/components/ui/badge';
import { getTranslator } from '@/i18n/server';

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const { t } = await getTranslator();
  return (
    <>
      <AppHeader
        href="/clinic"
        badge={<Badge tone="brand">{t('clinic.title')}</Badge>}
        right={<LanguageSwitch />}
      />
      {children}
      <ClinicNav />
    </>
  );
}
