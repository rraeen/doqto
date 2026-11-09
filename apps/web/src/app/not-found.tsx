import { Compass } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getTranslator } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getTranslator();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={Compass}
        title={t('common.notFound')}
        action={
          <Link href="/" className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}>
            {t('common.goHome')}
          </Link>
        }
      />
    </main>
  );
}
