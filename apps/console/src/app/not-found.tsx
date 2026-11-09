import Link from 'next/link';
import { buttonVariants } from '@doqto/ui/button';
import { getTranslator } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold text-ink">{t('common.notFound')}</p>
      <Link href="/" className={buttonVariants({ size: 'md' })}>
        {t('common.goHome')}
      </Link>
    </main>
  );
}
