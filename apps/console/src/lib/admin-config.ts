import {
  Bell,
  Building2,
  CalendarCheck,
  FlaskConical,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  Pill,
  ScrollText,
  Settings,
  Star,
  Stethoscope,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

export type AreaKey =
  | 'dashboard'
  | 'requests'
  | 'profileChanges'
  | 'doctors'
  | 'clinics'
  | 'labs'
  | 'pharmacies'
  | 'bookings'
  | 'reviews'
  | 'payments'
  | 'notifications'
  | 'audit'
  | 'settings';

export interface AreaItem {
  key: AreaKey;
  href: string;
  icon: LucideIcon;
  /** Roadmap phase in docs/plans/console-and-partner-platform-plan.md that builds this screen. */
  phase: string;
}

export const productName = 'Doqto Admin';
export const environmentTag: string | undefined = 'ADMIN';
export const tone: 'console' | 'admin' = 'admin';
/** Every path of the admin area starts with this prefix. */
export const basePath = '/admin';

export const providerKinds = ['doctors', 'clinics', 'labs', 'pharmacies'] as const;
export type ProviderKind = (typeof providerKinds)[number];

export function isProviderKind(value: unknown): value is ProviderKind {
  return typeof value === 'string' && (providerKinds as readonly string[]).includes(value);
}

export const groups: { labelKey: `groups.${string}`; items: AreaItem[] }[] = [
  {
    labelKey: 'groups.overview',
    items: [
      { key: 'dashboard', href: '/admin', icon: LayoutDashboard, phase: '2D' },
      { key: 'requests', href: '/admin/requests', icon: Inbox, phase: '2B+' },
      { key: 'profileChanges', href: '/admin/profile-changes', icon: UserCog, phase: '2B+' },
    ],
  },
  {
    labelKey: 'groups.providers',
    items: [
      { key: 'doctors', href: '/admin/doctors', icon: Stethoscope, phase: '2D' },
      { key: 'clinics', href: '/admin/clinics', icon: Building2, phase: '2D' },
      { key: 'labs', href: '/admin/labs', icon: FlaskConical, phase: '3A' },
      { key: 'pharmacies', href: '/admin/pharmacies', icon: Pill, phase: '3B' },
    ],
  },
  {
    labelKey: 'groups.marketplace',
    items: [
      { key: 'bookings', href: '/admin/bookings', icon: CalendarCheck, phase: '2D' },
      { key: 'reviews', href: '/admin/reviews', icon: Star, phase: '2D' },
    ],
  },
  {
    labelKey: 'groups.money',
    items: [{ key: 'payments', href: '/admin/payments', icon: IndianRupee, phase: '2E' }],
  },
  {
    labelKey: 'groups.operations',
    items: [
      { key: 'notifications', href: '/admin/notifications', icon: Bell, phase: '2D' },
      { key: 'audit', href: '/admin/audit', icon: ScrollText, phase: '2D' },
      { key: 'settings', href: '/admin/settings', icon: Settings, phase: '2D' },
    ],
  },
];

export const areas: AreaItem[] = groups.flatMap((g) => g.items);
