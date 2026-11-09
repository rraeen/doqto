import { UserRound } from 'lucide-react';
import { cn } from '../cn';

/** Filled Lucide `user-round`, centered in circular avatars and nav account buttons. */
export function UserRoundIcon({ className }: { className?: string }) {
  return (
    <UserRound
      className={cn('size-[70%] translate-y-[6%]', className)}
      fill="currentColor"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}
