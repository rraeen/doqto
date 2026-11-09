import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/app-header';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { AdminNav } from '@/components/shell/navs';
import { Badge } from '@/components/ui/badge';
import { getTranslator } from '@/i18n/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = await getTranslator();
  return (
    <>
      <AppHeader
        href="/admin"
        badge={
          <Badge tone="brand" className="hidden whitespace-nowrap min-[380px]:inline-flex">
            {t('admin.title')}
          </Badge>
        }
        right={<LanguageSwitch compact />}
      />
      <AdminNav />
      {children}
    </>
  );
}
