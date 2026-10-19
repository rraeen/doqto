'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={48}
      toastOptions={{
        classNames: {
          toast: 'rounded-lg border border-line bg-surface text-ink text-base shadow-lg',
          error: 'border-danger/30 text-danger',
          success: 'border-success/30',
        },
      }}
    />
  );
}
