import { Search } from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/components/shell/page';
import { buttonVariants } from '@/components/ui/button';
import { getTranslator } from '@/i18n/server';

export default async function HomePage() {
  const { t } = await getTranslator();
  return (
    <Page>
      <section className="rounded-xl bg-brand-700 px-5 py-8 text-white">
        <h1 className="text-3xl font-bold leading-tight">{t('home.title')}</h1>
        <p className="mt-2 text-brand-100">{t('home.subtitle')}</p>
        <Link
          href="/search"
          className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'mt-6' })}
        >
          <Search className="size-5" aria-hidden />
          {t('home.searchCta')}
        </Link>
      </section>
      <div className="mt-6 text-center">
        <Link href="/login" className={buttonVariants({ variant: 'link' })}>
          {t('home.signIn')}
        </Link>
      </div>
    </Page>
  );
}
