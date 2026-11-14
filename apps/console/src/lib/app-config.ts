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
/** A staff member with a temporary password chooses their own here before anything else. */
export const changePasswordPath = '/change-password';
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

/**
 * What a member needs to open each screen. null: every member (the dashboard). 'owner': only the
 * owner, never grantable to staff. Anything else is a permission the owner switches on per staff
 * member (the names are the ones in PERMISSIONS_BY_KIND in packages/shared). The API checks the
 * same rules; this only decides what to show.
 */
export const AREA_PERMISSION: Record<AreaKey, string | 'owner' | null> = {
  dashboard: null,
  appointments: 'appointments',
  queue: 'queue',
  messages: 'messages',
  schedule: 'schedule',
  reviews: 'reviews',
  staff: 'owner',
  profile: 'owner',
  settings: 'owner',
  labBookings: 'bookings',
  catalogue: 'catalogue',
  collection: 'collection',
  reports: 'reports',
  orders: 'orders',
  products: 'products',
  dispatch: 'dispatch',
};

export interface Member {
  role: 'owner' | 'staff';
  permissions: readonly string[];
}

/** Whether this member may open the screen. */
export function canOpenArea(key: AreaKey, member: Member): boolean {
  if (member.role === 'owner') return true;
  const need = AREA_PERMISSION[key];
  if (need === null) return true;
  return need !== 'owner' && member.permissions.includes(need);
}

/** The screens of this type this member may open, in menu order. */
export function allowedAreas(type: WorkspaceType, member: Member): AreaItem[] {
  return areasOf(type).filter((a) => canOpenArea(a.key, member));
}

/**
 * The area a path belongs to: the one with the longest matching address (the dashboard is the
 * workspace base path itself and only matches exactly). Undefined for an unknown path.
 */
export function areaAt(type: WorkspaceType, pathname: string): AreaItem | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  const base = workspaces[type].basePath;
  return areasOf(type)
    .filter((a) => path === a.href || (a.href !== base && path.startsWith(a.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function areasOf(type: WorkspaceType): AreaItem[] {
  return workspaces[type].groups.flatMap((g) => g.items);
}

/** The dashboard an account of this type lands on after sign-in. */
export function homeFor(type: WorkspaceType): string {
  return workspaces[type].basePath;
}
