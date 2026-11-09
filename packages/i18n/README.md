# @doqto/i18n

The translation core shared by the web apps. Each app owns its own message catalogs (`src/i18n/messages/en.ts`, `hi.ts`); this package supplies the typed translator, the client provider and the server helper.

```ts
// src/i18n/provider.tsx ('use client')
export const { I18nProvider, useI18n, useT } = createI18nContext<Locale, Messages>('doqto_lang');

// src/i18n/server.ts
export const { getLocale, getTranslator } = createServerI18n({ cookieName, defaultLocale, isLocale, getMessages });

// src/i18n/translate.ts
const t = createTranslator(messages);   // t('auth.resendIn', { seconds: 30 })
```

- Message keys are typed from the English catalog. The Hindi catalog is typed as the same shape, so a missing key fails the build.
- A missing key renders as the key, so a gap shows on screen instead of crashing the page.
- The language is a cookie. On localhost one choice follows you between apps; on real hosts the cookie is host-only.
