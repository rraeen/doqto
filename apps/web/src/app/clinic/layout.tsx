import type { ReactNode } from 'react';
import { AppFooter } from '@/components/shell/app-footer';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { AccountChip } from '@/components/shell/account-chip';
import { ClinicNav, ClinicTopNav } from '@/components/shell/navs';
import { Badge } from '@/components/ui/badge';
import { getTranslator } from '@/i18n/server';

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const { t } = await getTranslator();
  return (
    <>
      <AppHeader
        href="/clinic"
        badge={
          <Badge tone="brand" className="hidden whitespace-nowrap min-[380px]:inline-flex">
            {t('clinic.title')}
          </Badge>
        }
        center={<ClinicTopNav />}
        right={
          <>
            <LanguageSwitch compact />
            <AccountChip />
          </>
        }
      />
      {children}
      <AppFooter />
      <ClinicNav />
    </>
  );
}
