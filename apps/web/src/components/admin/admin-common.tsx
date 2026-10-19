'use client';

import type { VerificationStatus } from '@doqto/shared';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSignedIn } from '@/components/shell/signed-in';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/translate';

export const STATUSES: { value: VerificationStatus; label: MessageKey }[] = [
  { value: 'pending', label: 'adminVerify.tabPending' },
  { value: 'verified', label: 'adminVerify.tabVerified' },
  { value: 'rejected', label: 'adminVerify.tabRejected' },
];
export const TONE = { pending: 'warning', verified: 'success', rejected: 'danger' } as const;
export const queueKey = (status: VerificationStatus) => ['admin', 'doctors', status] as const;
export const detailKey = (id: string) => ['admin', 'doctor', id] as const;

export function isStatus(v: string | null): v is VerificationStatus {
  return v === 'pending' || v === 'verified' || v === 'rejected';
}

export function useDate() {
  const { locale } = useI18n();
  const fmt = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  return (iso: string) => fmt.format(new Date(iso));
}

/** Signed in and an admin; anything else gets a clear state instead of a failing request. */
export function useAdminGate(next: string): { ok: true } | { ok: false; node: ReactNode } {
  const { t } = useI18n();
  const gate = useSignedIn(next);
  if (!gate.me) return { ok: false, node: gate.node };
  if (!gate.me.roles.includes('admin')) {
    return {
      ok: false,
      node: <EmptyState icon={ShieldAlert} title={t('adminVerify.notAdmin')} />,
    };
  }
  return { ok: true };
}
