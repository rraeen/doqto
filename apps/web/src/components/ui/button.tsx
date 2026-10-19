import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        outline: 'border border-line bg-surface text-ink hover:bg-canvas',
        ghost: 'text-ink hover:bg-canvas',
        danger: 'bg-danger text-white hover:bg-danger/90',
        link: 'h-auto px-0 text-brand-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-tap px-4 text-base',
        // Front-desk actions: 56px tall, full width on phones.
        lg: 'h-tap-lg w-full px-6 text-lg',
        icon: 'size-tap',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
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
