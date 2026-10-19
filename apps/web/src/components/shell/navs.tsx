'use client';

import {
  CalendarDays,
  ClipboardList,
  Home,
  ListOrdered,
  Menu,
  Search,
  Stethoscope,
  Star,
  Bell,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { BottomNav, isActive } from './bottom-nav';

export function PatientNav() {
  const t = useT();
  return (
    <BottomNav
      label="Main"
      items={[
        { href: '/', label: t('nav.home'), icon: Home, exact: true },
        { href: '/search', label: t('nav.search'), icon: Search },
        { href: '/appointments', label: t('nav.appointments'), icon: CalendarDays },
        { href: '/profile', label: t('nav.profile'), icon: User },
      ]}
    />
  );
}

export function ClinicNav() {
  const t = useT();
  return (
    <BottomNav
      label="Clinic"
      items={[
        { href: '/clinic', label: t('nav.today'), icon: ClipboardList, exact: true },
        { href: '/clinic/queue', label: t('nav.queue'), icon: ListOrdered },
        { href: '/clinic/schedule', label: t('nav.schedule'), icon: CalendarDays },
        { href: '/clinic/more', label: t('nav.more'), icon: Menu },
      ]}
    />
  );
}

/** Admin is used from a laptop as often as a phone, so it gets a scrollable tab bar instead of a bottom nav. */
export function AdminNav() {
  const t = useT();
  const pathname = usePathname();
  const items = [
    { href: '/admin/doctors', label: t('nav.doctors'), icon: Stethoscope },
    { href: '/admin/reviews', label: t('nav.reviews'), icon: Star },
    { href: '/admin/notifications', label: t('nav.notifications'), icon: Bell },
  ];
  return (
    <nav aria-label="Admin" className="border-b border-line bg-surface">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap',
                  active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
