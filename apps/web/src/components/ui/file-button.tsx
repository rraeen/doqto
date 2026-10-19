'use client';

import { Upload } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './button';

interface FileButtonProps extends Omit<ButtonProps, 'onClick' | 'onSelect'> {
  accept: string[];
  maxBytes: number;
  onSelect: (file: File) => void;
  /** Called instead of `onSelect` when the file fails the type or size check. */
  onReject: (reason: 'type' | 'size') => void;
  children: ReactNode;
}

/** Opens the file picker (or camera on phones for images) and checks type and size first. */
export function FileButton({
  accept,
  maxBytes,
  onSelect,
  onReject,
  children,
  ...props
}: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!accept.includes(file.type)) onReject('type');
          else if (file.size > maxBytes) onReject('size');
          else onSelect(file);
        }}
      />
      <Button type="button" variant="outline" onClick={() => input.current?.click()} {...props}>
        <Upload className="size-5" aria-hidden />
        {children}
      </Button>
    </>
  );
}
