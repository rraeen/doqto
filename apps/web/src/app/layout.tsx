import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DemoBanner } from '@/components/demo-banner';
import { Toaster } from '@/components/ui/toast';
import { getMessages } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { getTranslator } from '@/i18n/server';
import { MockBoot } from '@/mocks/boot';
import { env } from '@/lib/env';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: 'Doqto: find a doctor, see live status, book', template: '%s · Doqto' },
  description:
    'Find verified doctors near you, see if the doctor is running late, and book a slot.',
  applicationName: 'Doqto',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766a',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getTranslator();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Providers>
            <MockBoot>
              <DemoBanner text={t('common.demoBanner')} />
              {children}
            </MockBoot>
            <Toaster />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
