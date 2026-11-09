'use client';

import { Languages } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { LOCALE_COOKIE, localeNames, locales, type Locale } from '@/i18n/config';
import { useI18n, writeLocaleCookie } from '@/i18n/provider';
import { cn } from '@/lib/cn';

const noSubscribe = () => () => undefined;
const hasChosen = () => document.cookie.split('; ').some((c) => c.startsWith(`${LOCALE_COOKIE}=`));

/**
 * Asks "English or हिन्दी?" the first time someone opens Doqto, then never again: the choice is
 * kept in the language cookie, and so is closing the sheet without choosing. After that the
 * language is changed from the footer. The text is in both languages on purpose, because the
 * visitor has not picked one yet.
 */
export function LanguagePrompt() {
  const { locale, setLocale } = useI18n();
  // On the server, and while hydrating, treat the choice as made so nothing flashes.
  const chosen = useSyncExternalStore(noSubscribe, hasChosen, () => true);
  const [closed, setClosed] = useState(false);

  const choose = (next: Locale) => {
    setClosed(true);
    setLocale(next);
  };
  const dismiss = () => {
    // Closing without choosing keeps the current language and stops the question coming back.
    setClosed(true);
    writeLocaleCookie(locale);
  };

  return (
    <Sheet
      open={!chosen && !closed}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
      title={
        <span className="flex items-center gap-2">
          <Languages className="size-5 text-brand-700" aria-hidden />
          Choose your language · अपनी भाषा चुनें
        </span>
      }
      description="You can change it any time from the bottom of the page. आप इसे पेज के नीचे से कभी भी बदल सकते हैं।"
      closeLabel="Close · बंद करें"
    >
      <div role="group" aria-label="Language · भाषा" className="grid grid-cols-2 gap-3">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => choose(l)}
            className={cn(
              'flex min-h-16 items-center justify-center rounded-2xl px-4 text-xl font-bold',
              l === locale ? 'neu-glow' : 'neu-raised text-ink',
            )}
          >
            {localeNames[l]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
