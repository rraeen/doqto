import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { getMessages, type Locale } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';

export function renderWithProviders(ui: ReactElement, { locale = 'en' as Locale } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <I18nProvider locale={locale} messages={getMessages(locale)}>
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      </I18nProvider>,
    ),
  };
}
