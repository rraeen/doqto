'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  className?: string;
}

/** Bottom sheet on phones, centred dialog from `sm` up. */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel = 'Close',
  children,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-xl bg-surface p-5 pb-safe shadow-lg focus:outline-none',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
            className,
          )}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-m-2 rounded-md p-2 text-ink-muted hover:bg-canvas"
              aria-label={closeLabel}
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
