import { Skeleton } from '@/components/ui/skeleton';

/** Shown while a route's data loads, so a slow phone never sees a blank screen. */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-24 sm:px-6"
      aria-busy
      aria-live="polite"
    >
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </main>
  );
}
