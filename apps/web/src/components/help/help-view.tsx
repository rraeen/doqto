'use client';

import { ChevronDown, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useT } from '@/i18n/provider';

const FAQ = [
  ['help.q1', 'help.a1'],
  ['help.q2', 'help.a2'],
  ['help.q3', 'help.a3'],
  ['help.q4', 'help.a4'],
  ['help.q5', 'help.a5'],
  ['help.q6', 'help.a6'],
] as const;

export function HelpView() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {t('help.title')}
        </h1>
        <p className="mt-1 text-lg font-medium text-brand-700">{t('help.subtitle')}</p>
      </div>
      <ul className="space-y-4">
        {FAQ.map(([q, a]) => (
          <li key={q}>
            <details className="neu-raised group rounded-2xl p-5 open:neu-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink [&::-webkit-details-marker]:hidden">
                {t(q)}
                <ChevronDown
                  className="size-5 shrink-0 text-brand-600 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t(a)}</p>
            </details>
          </li>
        ))}
      </ul>
      <section className="neu-inset flex items-start gap-4 rounded-2xl p-6">
        <LifeBuoy className="size-7 shrink-0 text-brand-600" aria-hidden />
        <div>
          <h2 className="font-bold text-ink">{t('help.stillTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('help.stillBody')}</p>
        </div>
      </section>
      <Link
        href="/"
        className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-auto px-10' })}
      >
        {t('help.backHome')}
      </Link>
    </div>
  );
}
