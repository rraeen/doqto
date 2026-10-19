'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once all boxes are filled. */
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Accessible name per box, e.g. `(n) => t('auth.digitLabel', { n })`. */
  digitLabel?: (n: number) => string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  disabled,
  autoFocus,
  digitLabel = (n) => `Digit ${n}`,
  ...aria
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  };

  const handleInput = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    // Android SMS autofill and keyboards may drop several digits into one box.
    const next = (value.slice(0, index) + digits).slice(0, length);
    commit(next, index + digits.length);
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[index]) commit(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0) commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) commit(pasted, pasted.length);
  };

  return (
    <div role="group" className="flex justify-between gap-2" {...aria}>
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          maxLength={length}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          value={char}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-full min-w-0 max-w-12 rounded-md border border-line bg-surface text-center text-2xl font-semibold text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50',
            invalid && 'border-danger',
          )}
        />
      ))}
    </div>
  );
}
