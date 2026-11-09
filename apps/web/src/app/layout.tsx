import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_Devanagari } from 'next/font/google';
import type { ReactNode } from 'react';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { Toaster } from '@/components/ui/toast';
import { getMessages } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { getTranslator } from '@/i18n/server';
import { MockBoot } from '@/mocks/boot';
import { env } from '@/lib/env';
import { Providers } from './providers';
import './globals.css';

// Manrope for Latin text; Noto Sans Devanagari fills in for Hindi, glyph by glyph. The Hindi font
// is not preloaded: its 119 KB file would otherwise be fetched on every English page, which is
// painful on 3G. The browser still downloads it the moment a Devanagari character appears.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-noto-deva',
  display: 'swap',
  preload: false,
});

const TITLE = 'Doqto: find a doctor, see live status, book';
const DESCRIPTION =
  'Find verified doctors near you, see if the doctor is running late, and book a slot.';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: TITLE, template: '%s · Doqto' },
  description: DESCRIPTION,
  applicationName: 'Doqto',
  appleWebApp: { capable: true, title: 'Doqto', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'Doqto',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_IN',
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Draw under the notch and home indicator; the layout adds safe-area padding where it matters.
  viewportFit: 'cover',
  themeColor: '#f0f4f0',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getTranslator();
  return (
    <html lang={locale} className={`${manrope.variable} ${devanagari.variable}`}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Providers>
            <MockBoot>
              <OfflineBanner />
              {children}
              <InstallPrompt />
            </MockBoot>
            <Toaster />
            <PwaRegister />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
