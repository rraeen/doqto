'use client';

import {
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  ListOrdered,
  Menu,
  MessageCircle,
  Stethoscope,
  Star,
  Bell,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { BottomNav, isActive, TopNav, type NavItem } from './bottom-nav';

function usePatientItems(): NavItem[] {
  const t = useT();
  return [
    { href: '/', label: t('nav.home'), icon: Home, exact: true },
    { href: '/appointments', label: t('nav.appointments'), icon: CalendarDays },
    { href: '/records', label: t('nav.records'), icon: FileText },
    { href: '/consult', label: t('nav.consult'), icon: MessageCircle },
    { href: '/profile', label: t('nav.profile'), icon: UserRound },
  ];
}

function useClinicItems(): NavItem[] {
  const t = useT();
  return [
    { href: '/clinic', label: t('nav.today'), icon: ClipboardList, exact: true },
    { href: '/clinic/queue', label: t('nav.queue'), icon: ListOrdered },
    { href: '/clinic/schedule', label: t('nav.schedule'), icon: CalendarDays },
    { href: '/clinic/more', label: t('nav.more'), icon: Menu },
  ];
}

function isConsultChatPath(pathname: string) {
  return /^\/consult\/[^/]+/.test(pathname);
}

export function PatientNav() {
  const pathname = usePathname();
  const items = usePatientItems().filter((item) => item.href !== '/consult');
  if (isConsultChatPath(pathname)) return null;
  return <BottomNav label="Main" items={items} />;
}

/** Desktop header links; profile is only via `AccountChip` (avatar menu). */
export function PatientTopNav() {
  const items = usePatientItems().filter((item) => item.href !== '/profile');
  return <TopNav label="Main" items={items} />;
}

export function ClinicNav() {
  return <BottomNav label="Clinic" items={useClinicItems()} />;
}

export function ClinicTopNav() {
  return <TopNav label="Clinic" items={useClinicItems()} />;
}

/** Admin is used from a laptop as often as a phone, so it gets a scrollable pill tab row instead of a bottom nav. */
export function AdminNav() {
  const t = useT();
  const pathname = usePathname();
  const items = [
    { href: '/admin/doctors', label: t('nav.doctors'), icon: Stethoscope },
    { href: '/admin/reviews', label: t('nav.reviews'), icon: Star },
    { href: '/admin/notifications', label: t('nav.notifications'), icon: Bell },
  ];
  return (
    <nav aria-label="Admin" className="relative z-10 px-3 pt-4 sm:px-6">
      <ul className="neu-inset mx-auto flex max-w-[1100px] gap-1 overflow-x-auto rounded-full p-1">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-full px-2 text-xs font-bold whitespace-nowrap sm:px-4 sm:text-sm',
                  active ? 'neu-raised text-brand-700' : 'text-ink-muted hover:text-brand-600',
                )}
              >
                <Icon className="hidden size-4 sm:block" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
