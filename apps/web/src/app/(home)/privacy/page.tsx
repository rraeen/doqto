import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicFooter, PublicNav } from '@/components/landing/public-nav';
import { getLocale } from '@/i18n/server';
import { PRIVACY } from '@/lib/privacy-content';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Doqto collects, why, and the choices you have.',
};

export default async function PrivacyPage() {
  const p = PRIVACY[await getLocale()];
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <PublicNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{p.title}</h1>
          <p className="text-sm font-medium text-ink-muted">{p.updated}</p>
          <p className="text-base leading-relaxed text-ink-muted">{p.intro}</p>
        </header>

        {p.sections.map((s) => (
          <section key={s.heading} className="neu-card space-y-3 rounded-3xl p-5 sm:p-7">
            <h2 className="text-lg font-bold text-ink sm:text-xl">{s.heading}</h2>
            <ul className="space-y-2.5">
              {s.body.map((line) => (
                <li key={line} className="flex gap-3 leading-relaxed text-ink-muted">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-500"
                  />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-ink sm:text-xl">{p.contactHeading}</h2>
          <p className="leading-relaxed text-ink-muted">
            {p.contactBody}{' '}
            <Link
              href="/help"
              className="font-bold text-brand-700 underline-offset-4 hover:underline"
            >
              {p.contactLink}
            </Link>
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
