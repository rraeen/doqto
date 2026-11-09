import {
  CalendarCheck,
  CalendarClock,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Pill,
  Settings,
  ShoppingBag,
  Star,
  TestTube,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export const workspaceTypes = ['clinic', 'lab', 'pharmacy'] as const;
export type WorkspaceType = (typeof workspaceTypes)[number];

export function isWorkspaceType(value: unknown): value is WorkspaceType {
  return typeof value === 'string' && (workspaceTypes as readonly string[]).includes(value);
}

export type AreaKey =
  | 'dashboard'
  | 'appointments'
  | 'queue'
  | 'messages'
  | 'schedule'
  | 'reviews'
  | 'staff'
  | 'profile'
  | 'settings'
  | 'labBookings'
  | 'catalogue'
  | 'collection'
  | 'reports'
  | 'orders'
  | 'products'
  | 'dispatch';

export interface AreaItem {
  key: AreaKey;
  href: string;
  icon: LucideIcon;
  /** Roadmap phase in docs/plans/console-and-partner-platform-plan.md that builds this screen. */
  phase: string;
}

export interface NavGroupConfig {
  labelKey: `groups.${string}`;
  items: AreaItem[];
}

export interface WorkspaceConfig {
  type: WorkspaceType;
  /** Every path of this workspace starts with this prefix. */
  basePath: string;
  groups: NavGroupConfig[];
}

export const productName = 'Doqto Console';
export const tone: 'console' | 'admin' = 'console';
export const environmentTag: string | undefined = undefined;

/** Public pages and the sign-in flow. */
export const loginPath = '/login';
export const registerPath = '/register';
/** The panel of services (clinic, lab, pharmacy): choose one, or set one up. */
export const servicesPath = '/services';
/** The admin area, for the Doqto team. */
export const adminPath = '/admin';
/** The application form: apply for services, first time or later from Settings. */
export const applyPath = '/apply';

/** One navigation per workspace type, so a pharmacy never sees clinic screens. */
export const workspaces: Record<WorkspaceType, WorkspaceConfig> = {
  clinic: {
    type: 'clinic',
    basePath: '/clinic',
    groups: [
      {
        labelKey: 'groups.practice',
        items: [
          { key: 'dashboard', href: '/clinic', icon: LayoutDashboard, phase: '2C' },
          { key: 'appointments', href: '/clinic/appointments', icon: CalendarCheck, phase: '2C' },
          { key: 'queue', href: '/clinic/queue', icon: ListOrdered, phase: '2C' },
          { key: 'messages', href: '/clinic/messages', icon: MessageCircle, phase: '2C' },
          { key: 'schedule', href: '/clinic/schedule', icon: CalendarClock, phase: '2C' },
          { key: 'reviews', href: '/clinic/reviews', icon: Star, phase: '2C' },
        ],
      },
      {
        labelKey: 'groups.manage',
        items: [
          { key: 'staff', href: '/clinic/staff', icon: Users, phase: '2B' },
          { key: 'profile', href: '/clinic/profile', icon: UserRound, phase: '2B+' },
          { key: 'settings', href: '/clinic/settings', icon: Settings, phase: '2C' },
        ],
      },
    ],
  },
  lab: {
    type: 'lab',
    basePath: '/lab',
    groups: [
      {
        labelKey: 'groups.lab',
        items: [
          { key: 'dashboard', href: '/lab', icon: LayoutDashboard, phase: '3A' },
          { key: 'labBookings', href: '/lab/bookings', icon: CalendarCheck, phase: '3A' },
          { key: 'catalogue', href: '/lab/catalogue', icon: FlaskConical, phase: '3A' },
          { key: 'collection', href: '/lab/collection', icon: TestTube, phase: '3A' },
          { key: 'reports', href: '/lab/reports', icon: FileText, phase: '3A' },
        ],
      },
      {
        labelKey: 'groups.manage',
        items: [
          { key: 'staff', href: '/lab/staff', icon: Users, phase: '3A' },
          { key: 'profile', href: '/lab/profile', icon: UserRound, phase: '3A' },
          { key: 'settings', href: '/lab/settings', icon: Settings, phase: '3A' },
        ],
      },
    ],
  },
  pharmacy: {
    type: 'pharmacy',
    basePath: '/pharmacy',
    groups: [
      {
        labelKey: 'groups.pharmacy',
        items: [
          { key: 'dashboard', href: '/pharmacy', icon: LayoutDashboard, phase: '3B' },
          { key: 'orders', href: '/pharmacy/orders', icon: ShoppingBag, phase: '3B' },
          { key: 'products', href: '/pharmacy/products', icon: Pill, phase: '3B' },
          { key: 'dispatch', href: '/pharmacy/dispatch', icon: Truck, phase: '3B' },
        ],
      },
      {
        labelKey: 'groups.manage',
        items: [
          { key: 'staff', href: '/pharmacy/staff', icon: Users, phase: '3B' },
          { key: 'profile', href: '/pharmacy/profile', icon: UserRound, phase: '3B' },
          { key: 'settings', href: '/pharmacy/settings', icon: Settings, phase: '3B' },
        ],
      },
    ],
  },
};

export function areasOf(type: WorkspaceType): AreaItem[] {
  return workspaces[type].groups.flatMap((g) => g.items);
}

/** The dashboard an account of this type lands on after sign-in. */
export function homeFor(type: WorkspaceType): string {
  return workspaces[type].basePath;
}
