import { env } from '@/lib/env';

export function DemoBanner({ text }: { text: string }) {
  if (!env.demoMode) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-warning-bg px-4 py-2 text-center text-xs font-medium text-warning"
    >
      {text}
    </div>
  );
}
