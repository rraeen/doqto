import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach the merger our custom spacing (`h-tap`) and the `2xs` text size, so overrides resolve.
const twMerge = extendTailwindMerge({
  extend: { theme: { spacing: ['tap', 'tap-lg'], text: ['2xs'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
