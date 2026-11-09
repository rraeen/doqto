'use client';

import type { Me } from '@doqto/shared';
import { ArrowLeft, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { safeNext } from '@/components/auth/login-flow';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { authErrorMessage } from '@/lib/api/messages';
import { formatE164ForDisplay } from '@/lib/phone';
import { useLogout, useUpdateMe } from '@/lib/session';

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="neu-card space-y-6 rounded-xl p-6 sm:p-8">
      <h2 className="flex items-center gap-3 text-xl font-bold text-ink">
        <Icon className="size-6 text-brand-600" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ProfileEdit({
  me,
  nameMax,
  welcome,
}: {
  me: Me;
  nameMax: number;
  welcome: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState(me.name ?? '');
  const saveName = useUpdateMe();
  const savePref = useUpdateMe();
  const signOut = useLogout();

  const trimmed = name.trim();
  const changed = trimmed !== (me.name ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || !changed) return;
    saveName.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          toast.success(t('common.saved'));
          const next = safeNext(params.get('next'));
          if (welcome) router.replace(next ?? '/');
          else router.push('/profile');
        },
      },
    );
  };

  const savePreference = (patch: { whatsappOptIn: boolean }) =>
    savePref.mutate(patch, {
      onSuccess: () => toast.success(t('common.saved')),
      onError: (err) => toast.error(authErrorMessage(err, t)),
    });

  return (
    <div className="space-y-8">
      {!welcome && (
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('profile.backToProfile')}
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {welcome ? t('auth.welcomeTitle') : t('profile.editTitle')}
        </h1>
        <p className="mt-1 text-lg font-medium text-brand-700">
          {welcome ? t('auth.welcomeBody') : t('profile.editSubtitle')}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-8">
        <Section icon={UserRound} title={t('profile.personalTitle')}>
          <div className="grid gap-6 md:grid-cols-2">
            <Field
              label={t('profile.nameLabel')}
              hint={t('profile.nameHint')}
              error={saveName.error ? authErrorMessage(saveName.error, t) : undefined}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  autoComplete="name"
                  autoFocus={welcome}
                  maxLength={nameMax}
                  placeholder={t('profile.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('profile.phoneLabel')} hint={t('profile.mobileVerified')}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={formatE164ForDisplay(me.phone)}
                  readOnly
                  disabled
                />
              )}
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto sm:px-10"
              loading={saveName.isPending}
              disabled={!trimmed || !changed}
            >
              {welcome ? t('common.continue') : t('profile.saveChanges')}
            </Button>
          </div>
        </Section>
      </form>

      <Section icon={Settings} title={t('profile.preferencesTitle')}>
        <div className="flex items-center justify-between gap-4">
          <p className="font-bold text-ink">{t('profile.languageLabel')}</p>
          <LanguageSwitch />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="wa-label" className="font-bold text-ink">
              {t('profile.whatsappLabel')}
            </p>
            <p id="wa-hint" className="mt-1 text-sm text-ink-muted">
              {t('profile.whatsappHint')}
            </p>
          </div>
          <Switch
            aria-labelledby="wa-label"
            aria-describedby="wa-hint"
            checked={me.whatsappOptIn}
            disabled={savePref.isPending}
            onCheckedChange={(whatsappOptIn) => savePreference({ whatsappOptIn })}
          />
        </div>
      </Section>

      <Section icon={ShieldCheck} title={t('profile.securityTitle')}>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-danger sm:w-auto sm:px-10"
          loading={signOut.isPending}
          onClick={() =>
            signOut.mutate(undefined, {
              onSettled: () => {
                toast(t('profile.loggedOut'));
                router.replace('/');
              },
            })
          }
        >
          <LogOut className="size-5" aria-hidden />
          {t('profile.logout')}
        </Button>
      </Section>
    </div>
  );
}
