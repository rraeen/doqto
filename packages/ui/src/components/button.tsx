import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

const variants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:bg-line disabled:text-ink-muted disabled:shadow-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'neu-glow rounded-full hover:brightness-110',
        secondary: 'neu-raised rounded-full text-brand-700 hover:brightness-105',
        outline: 'neu-raised rounded-full text-ink hover:brightness-105',
        ghost: 'text-ink hover:brightness-105',
        danger: 'neu-raised rounded-full text-danger hover:brightness-105',
        link: 'h-auto px-0 text-brand-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-10 px-3 text-sm',
        md: 'h-tap px-4 text-base',
        // Front-desk actions: 56px tall, full width on phones.
        lg: 'h-tap-lg w-full px-6 text-lg',
        icon: 'size-tap',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

/** Class names for a button, merged so `className` overrides (like `h-20`) really win. */
export function buttonVariants(options?: Parameters<typeof variants>[0]): string {
  return cn(variants(options));
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
