import type { ReactNode } from 'react';
import { AccountChip } from '@/components/shell/account-chip';
import { AppFooter } from '@/components/shell/app-footer';
import { AppHeader } from '@/components/shell/app-header';
import { MobilePatientHeader } from '@/components/shell/mobile-patient-header';
import { GuestLanguageSwitch } from '@/components/shell/guest-language-switch';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { PatientNav, PatientTopNav } from '@/components/shell/navs';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MobilePatientHeader />
      <AppHeader
        className="hidden md:block"
        center={<PatientTopNav />}
        right={
          <>
            <NotificationsBell />
            <GuestLanguageSwitch />
            <AccountChip />
          </>
        }
      />
      {children}
      <AppFooter />
      <PatientNav />
    </>
  );
}
