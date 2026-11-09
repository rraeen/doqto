import { Building2, FlaskConical, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import type { WorkspaceType } from '@doqto/shared';
import type { ProviderKind } from '@/lib/admin-config';

export const KIND_ICON: Record<ProviderKind, LucideIcon> = {
  doctors: Stethoscope,
  clinics: Building2,
  labs: FlaskConical,
  pharmacies: Pill,
};

export const KIND_SINGULAR = {
  doctors: 'kinds.doctor',
  clinics: 'kinds.clinic',
  labs: 'kinds.lab',
  pharmacies: 'kinds.pharmacy',
} as const;

/** The service an application is for (clinic or doctor, lab, pharmacy). */
export const KIND_ICON_BY_SERVICE: Record<WorkspaceType, LucideIcon> = {
  clinic: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
};
