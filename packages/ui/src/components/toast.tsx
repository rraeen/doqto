'use client';

import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast as sonner, Toaster as Sonner, type ExternalToast } from 'sonner';

const badge =
  'flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-current/15';

const icons = {
  success: (
    <span className={`${badge} bg-brand-500/25 text-brand-700`}>
      <CheckCircle2 className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  ),
  error: (
    <span className={`${badge} bg-danger-bg text-danger`}>
      <XCircle className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  ),
  warning: (
    <span className={`${badge} bg-warning-bg text-warning`}>
      <TriangleAlert className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  ),
  info: (
    <span className={`${badge} bg-info-bg text-info`}>
      <Info className="size-5" strokeWidth={2.2} aria-hidden />
    </span>
  ),
};

/**
 * `toast("Saved")` for a plain message now gets the info icon too, so every message in the app
 * has an icon; `toast.success`, `.error`, `.warning` and `.info` work as before.
 */
export const toast = Object.assign(
  (message: ReactNode, data?: ExternalToast) => sonner(message, { icon: icons.info, ...data }),
  sonner,
);

/**
 * Messages that pop up after an action ("Visit cancelled", "Could not send"): a raised card in
 * the app's style with a coloured icon, at the bottom right. They are not shown on phones (the
 * `globals.css` rule hides them below 768px) but stay in the page for screen readers.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      offset={{ bottom: 24, right: 24 }}
      visibleToasts={3}
      duration={4500}
      icons={icons}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'neu-raised flex w-[22rem] max-w-[calc(100vw-3rem)] items-center gap-3.5 rounded-2xl p-3.5 pr-5 text-ink',
          icon: 'm-0 flex shrink-0 items-center justify-center',
          content: 'min-w-0 flex-1',
          title: 'text-sm font-semibold leading-snug text-ink',
          description: 'mt-0.5 text-xs leading-snug text-ink-muted',
          actionButton: 'rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-ink',
          cancelButton: 'rounded-full px-3 py-1.5 text-xs font-bold text-ink-muted',
        },
      }}
    />
  );
}
