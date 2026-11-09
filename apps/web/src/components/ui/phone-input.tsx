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
        'neu-inset flex h-tap w-full items-center overflow-hidden rounded-2xl focus-within:ring-2 focus-within:ring-brand-500/40 has-[[aria-invalid=true]]:ring-2 has-[[aria-invalid=true]]:ring-danger/50',
        className,
      )}
    >
      <span
        className="flex h-full items-center px-4 text-base font-semibold text-ink-muted"
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
