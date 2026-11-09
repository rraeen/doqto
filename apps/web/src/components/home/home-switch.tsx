'use client';

import type { ReactNode } from 'react';
import { AccountChip } from '@/components/shell/account-chip';
import { NotificationsBell } from '@/components/shell/notifications-bell';
import { AppFooter } from '@/components/shell/app-footer';
import { AppHeader } from '@/components/shell/app-header';
import { PatientNav, PatientTopNav } from '@/components/shell/navs';
import { useMe } from '@/lib/session';
import { HomeDashboard } from './home-dashboard';
import { MobilePatientHeader } from '@/components/shell/mobile-patient-header';

/**
 * `/` is the public landing page for everyone, rendered on the server so search engines see it.
 * Once `/me` says the visitor is signed in, the dashboard takes over.
 */
function SignedInHome() {
  return (
    <>
      <MobilePatientHeader />
      <AppHeader
        className="hidden md:block"
        center={<PatientTopNav />}
        right={
          <>
            <NotificationsBell />
            <AccountChip />
          </>
        }
      />
      <HomeDashboard />
      <AppFooter />
      <PatientNav />
    </>
  );
}

export function HomeSwitch({ landing }: { landing: ReactNode }) {
  const me = useMe();
  if (me.isPending) {
    return <div className="min-h-dvh bg-surface" aria-busy aria-live="polite" />;
  }
  if (!me.data) return landing;
  return <SignedInHome />;
}
