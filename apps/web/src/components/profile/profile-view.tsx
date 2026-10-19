'use client';

import type { Me } from '@doqto/shared';
import { LogIn, LogOut, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { safeNext } from '@/components/auth/login-flow';
import { PageTitle } from '@/components/shell/page';
import { LanguageSwitch } from '@/components/shell/language-switch';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { authErrorMessage } from '@/lib/api/messages';
import { formatE164ForDisplay } from '@/lib/phone';
import { useLogout, useMe, useUpdateMe } from '@/lib/session';

/** `nameMax` is the contract's `NAME_MAX`, passed from the server page to keep Zod out of the bundle. */
export function ProfileView({ nameMax }: { nameMax: number }) {
  const t = useT();
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <EmptyState
        title={t('common.somethingWrong')}
        action={
          <Button variant="outline" onClick={() => void me.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  if (!me.data) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('profile.signInPrompt')}
        action={
          <Link href="/login?next=/profile" className={buttonVariants({ size: 'lg' })}>
            {t('home.signIn')}
          </Link>
        }
      />
    );
  }
  // Remount the form when the user changes so the name field starts from saved data.
  return <ProfileForm key={me.data.id} me={me.data} nameMax={nameMax} />;
}

function ProfileForm({ me, nameMax }: { me: Me; nameMax: number }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const [name, setName] = useState(me.name ?? '');
  const saveName = useUpdateMe();
  const savePref = useUpdateMe();
  const signOut = useLogout();

  const trimmed = name.trim();
  const nameChanged = trimmed !== (me.name ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || !nameChanged) return;
    saveName.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          toast.success(t('common.saved'));
          const next = safeNext(params.get('next'));
          if (welcome) router.replace(next ?? '/');
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
    <div className="space-y-5">
      {welcome ? (
        <PageTitle description={t('auth.welcomeBody')}>{t('auth.welcomeTitle')}</PageTitle>
      ) : (
        <PageTitle>{t('profile.title')}</PageTitle>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
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
          <div>
            <p className="text-sm font-medium text-ink">{t('profile.phoneLabel')}</p>
            <p className="mt-1 text-base text-ink-muted">{formatE164ForDisplay(me.phone)}</p>
          </div>
          <Button
            type="submit"
            className="w-full"
            loading={saveName.isPending}
            disabled={!trimmed || !nameChanged}
          >
            {welcome ? t('common.continue') : t('common.save')}
          </Button>
        </form>
      </Card>

      <Card className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-ink">{t('profile.languageLabel')}</p>
          <LanguageSwitch />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="wa-label" className="text-sm font-medium text-ink">
              {t('profile.whatsappLabel')}
            </p>
            <p id="wa-hint" className="mt-1 text-xs text-ink-muted">
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
      </Card>

      <Link
        href="/clinic"
        className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm font-medium text-brand-700 hover:bg-canvas"
      >
        <Stethoscope className="size-5" aria-hidden />
        {t('profile.doctorLink')}
      </Link>

      <Button
        variant="outline"
        className="w-full text-danger"
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
    </div>
  );
}
