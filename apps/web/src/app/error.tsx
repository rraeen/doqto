'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/i18n/provider';

/** The last safety net for a screen that crashed, with a way to try again. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={TriangleAlert}
        title={t('common.somethingWrong')}
        action={
          <Button type="button" size="lg" className="w-auto px-10" onClick={reset}>
            {t('common.retry')}
          </Button>
        }
      />
    </main>
  );
}
