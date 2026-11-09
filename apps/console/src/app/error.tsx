'use client';

import { Button } from '@doqto/ui/button';
import { useT } from '@/i18n/provider';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-lg font-semibold text-ink">{t('common.somethingWrong')}</p>
      {error.digest && <p className="text-xs text-ink-muted">Ref: {error.digest}</p>}
      <Button onClick={reset}>{t('common.retry')}</Button>
    </main>
  );
}
