import type { UnitStatus } from '@doqto/shared';
import type { StatusTone } from '@doqto/ui/status-chip';

/** One colour per approval status, the same everywhere in the console. */
export const unitStatusTone: Record<UnitStatus, StatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  changes_requested: 'warning',
  verified: 'success',
  rejected: 'danger',
  suspended: 'danger',
};
