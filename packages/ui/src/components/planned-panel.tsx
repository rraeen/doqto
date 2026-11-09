import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';
import { Panel } from './panel';

/** Stand-in for a screen that is planned but not built yet: says so plainly and names the phase. */
export function PlannedPanel({
  icon,
  title,
  description,
  phase,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  phase?: ReactNode;
}) {
  return (
    <Panel>
      <EmptyState icon={icon} title={title} description={description} action={phase} />
    </Panel>
  );
}
