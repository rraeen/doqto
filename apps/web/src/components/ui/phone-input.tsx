'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { normaliseIndianDigits, toE164 } from '@/lib/phone';

interface PhoneInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  /** Called on every change with the E.164 number, or null while incomplete or invalid. */
  onValueChange: (e164: string | null, digits: string) => void;
  defaultDigits?: string;
}

export function PhoneInput({
  onValueChange,
  defaultDigits = '',
  className,
  ...props
}: PhoneInputProps) {
  const [digits, setDigits] = useState(defaultDigits);
  const display = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
  return (
    <div
      className={cn(
        'flex h-tap w-full items-center overflow-hidden rounded-md border border-line bg-surface focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200 has-[[aria-invalid=true]]:border-danger',
        className,
      )}
    >
      <span
        className="flex h-full items-center border-r border-line bg-canvas px-3 text-base text-ink-muted"
        aria-hidden
      >
        +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base tracking-wide text-ink placeholder:text-ink-muted/60 focus:outline-none"
        value={display}
        onChange={(e) => {
          const next = normaliseIndianDigits(e.target.value);
          setDigits(next);
          onValueChange(toE164(next), next);
        }}
        {...props}
      />
    </div>
  );
}
