import { Toaster } from '@doqto/ui/toast';
import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_Devanagari } from 'next/font/google';
import type { ReactNode } from 'react';
import { getMessages } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { getTranslator } from '@/i18n/server';
import { productName } from '@/lib/app-config';
import { Providers } from './providers';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-noto-deva',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: productName, template: '%s · ' + productName },
  description: 'Doqto Console: the practice workspace for doctors and their staff.',
  applicationName: productName,
  // A work tool: keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f0f4f0',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getTranslator();
  return (
    <html lang={locale} className={manrope.variable + ' ' + devanagari.variable}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
