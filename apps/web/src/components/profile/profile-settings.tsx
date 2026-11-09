'use client';

import { DELETE_CONFIRM_WORD } from '@doqto/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  Download,
  Globe,
  LogOut,
  MessageCircle,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAppointments } from '@/components/appointments/use-appointments';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useI18n } from '@/i18n/provider';
import { accountApi } from '@/lib/api/lazy';
import { env } from '@/lib/env';
import { clearOfflineVisits } from '@/lib/offline-card';
import { downloadTextFile } from '@/lib/prescription';
import { disablePush, enablePush, showTestAlert, usePushState } from '@/lib/push';
import { meQueryKey, useLogoutAll, useUpdateMe } from '@/lib/session';

function Card({
  id,
  icon: Icon,
  title,
  children,
  tone,
}: {
  id: string;
  icon: typeof Bell;
  title: string;
  children: ReactNode;
  tone?: 'danger';
}) {
  return (
    <section
      aria-labelledby={id}
      className={
        tone === 'danger'
          ? 'neu-card space-y-4 rounded-3xl border-2 border-danger/30 p-5 sm:p-7'
          : 'neu-card space-y-4 rounded-3xl p-5 sm:p-7'
      }
    >
      <h2 id={id} className="flex items-center gap-3 text-lg font-bold text-ink">
        <Icon
          className={tone === 'danger' ? 'size-5 text-danger' : 'size-5 text-brand-700'}
          aria-hidden
        />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint?: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{label}</p>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
      {control}
    </div>
  );
}

export function ProfileSettings() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const { me, all } = useAppointments();
  const update = useUpdateMe();
  const logoutAll = useLogoutAll();
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const push = usePushState();
  const [pushBusy, setPushBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (me.isPending) {
    return (
      <div className="space-y-5" aria-busy>
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        title={t('profile.settingsSignIn')}
        action={
          <Link
            href="/login?next=%2Fprofile%2Fsettings"
            className={buttonVariants({ size: 'lg', className: 'w-auto px-10' })}
          >
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  const user = me.data;

  const togglePush = async (on: boolean) => {
    setPushBusy(true);
    try {
      if (on) {
        const state = await enablePush();
        if (state === 'blocked') toast.error(t('profile.pushBlocked'));
        else if (state === 'on') toast.success(t('profile.pushOnDone'));
      } else {
        await disablePush();
      }
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setPushBusy(false);
    }
  };

  const download = async () => {
    setExporting(true);
    try {
      // With the API (or its mocks) the server compiles the file; otherwise it is built from what
      // this device already has.
      const data =
        env.apiMocks || env.bookingApi
          ? await accountApi.exportMyData()
          : {
              generatedAt: new Date().toISOString(),
              profile: user,
              appointments: all.map((a) => ({
                id: a.id,
                doctor: a.doctor.name,
                clinic: a.clinic.name,
                start: a.start,
                status: a.status,
              })),
            };
      downloadTextFile('doqto-my-data.json', JSON.stringify(data, null, 2));
      toast.success(t('profile.exportDone'));
    } catch {
      toast.error(t('common.somethingWrong'));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (typed.trim() !== DELETE_CONFIRM_WORD) return;
    setDeleting(true);
    try {
      await accountApi.deleteMyAccount();
      clearOfflineVisits();
      await disablePush();
      qc.setQueryData(meQueryKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] });
      toast.success(t('profile.deleteDone'));
      router.replace('/');
    } catch {
      toast.error(t('common.somethingWrong'));
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
        {t('profile.settingsTitle')}
      </h1>

      <Card id="alerts" icon={Bell} title={t('profile.settingsAlerts')}>
        <Row
          label={t('profile.whatsappLabel')}
          hint={t('profile.whatsappHint')}
          control={
            <Switch
              checked={user.whatsappOptIn}
              disabled={update.isPending}
              aria-label={t('profile.whatsappLabel')}
              onCheckedChange={(whatsappOptIn) =>
                update.mutate(
                  { whatsappOptIn },
                  { onError: () => toast.error(t('common.somethingWrong')) },
                )
              }
            />
          }
        />
        <div className="h-px bg-line" />
        <Row
          label={t('profile.pushLabel')}
          hint={
            push === 'unsupported'
              ? t('profile.pushUnsupported')
              : push === 'blocked'
                ? t('profile.pushBlocked')
                : t('profile.pushHint')
          }
          control={
            <Switch
              checked={push === 'on'}
              disabled={pushBusy || push === 'unsupported' || push === 'blocked'}
              aria-label={t('profile.pushLabel')}
              onCheckedChange={(on) => void togglePush(on)}
            />
          }
        />
        {push === 'on' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="px-5"
            onClick={() =>
              void showTestAlert(t('profile.testAlertTitle'), t('profile.testAlertBody'))
            }
          >
            <BellRing className="size-4" aria-hidden />
            {t('profile.testAlert')}
          </Button>
        )}
      </Card>

      <Card id="language" icon={Globe} title={t('profile.languageLabel')}>
        <LanguageSwitch />
      </Card>

      <Card id="data" icon={MessageCircle} title={t('profile.settingsData')}>
        <p className="text-sm text-ink-muted">{t('profile.exportHint')}</p>
        <Button type="button" variant="outline" loading={exporting} onClick={() => void download()}>
          <Download className="size-5" aria-hidden />
          {t('profile.exportCta')}
        </Button>
      </Card>

      <Card id="security" icon={LogOut} title={t('profile.settingsSecurity')}>
        <p className="text-sm text-ink-muted">{t('profile.logoutAllHint')}</p>
        <Button type="button" variant="outline" onClick={() => setLogoutAllOpen(true)}>
          <LogOut className="size-5" aria-hidden />
          {t('profile.logoutAllCta')}
        </Button>
        <ConfirmSheet
          open={logoutAllOpen}
          onOpenChange={setLogoutAllOpen}
          title={t('profile.logoutAllTitle')}
          description={t('profile.logoutAllBody')}
          confirmLabel={t('profile.logoutAllCta')}
          cancelLabel={t('common.cancel')}
          loading={logoutAll.isPending}
          onConfirm={() =>
            logoutAll.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('profile.logoutAllDone'));
                router.replace('/');
              },
              onError: () => toast.error(t('common.somethingWrong')),
            })
          }
        />
      </Card>

      <Card id="danger" icon={ShieldAlert} title={t('profile.deleteTitle')} tone="danger">
        <p className="text-sm text-ink-muted">{t('profile.deleteHint')}</p>
        <Sheet
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setTyped('');
          }}
          title={t('profile.deleteConfirmTitle')}
          description={t('profile.deleteConfirmBody')}
          closeLabel={t('common.close')}
          trigger={
            <Button type="button" variant="outline" className="text-danger">
              <Trash2 className="size-5" aria-hidden />
              {t('profile.deleteCta')}
            </Button>
          }
        >
          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>{t('profile.deleteLose1')}</li>
              <li>{t('profile.deleteLose2')}</li>
              <li>{t('profile.deleteKeep')}</li>
            </ul>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-ink">
                {t('profile.deleteType', { word: DELETE_CONFIRM_WORD })}
              </span>
              <Input
                value={typed}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setTyped(e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="danger"
              size="lg"
              disabled={typed.trim() !== DELETE_CONFIRM_WORD}
              loading={deleting}
              onClick={() => void deleteAccount()}
            >
              {t('profile.deleteConfirmCta')}
            </Button>
          </div>
        </Sheet>
      </Card>
    </div>
  );
}
