import { env } from '@/lib/env';

export function DemoBanner({ text }: { text: string }) {
  if (!env.demoMode) return null;
  return (
    <div
      role="status"
      className="bg-warning-bg px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-xs font-medium text-warning"
    >
      {text}
    </div>
  );
}
