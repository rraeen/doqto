'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { Sheet } from './sheet';

interface ConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  children?: ReactNode;
}

/** Confirmation for destructive or important actions, as a bottom sheet on phones. */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading,
  danger,
  children,
}: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={cancelLabel}
    >
      {children}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
