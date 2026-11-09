'use client';

import { CircleHelp, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { formatE164ForDisplay } from '@/lib/phone';
import { useLogout, useMe } from '@/lib/session';

function Item({
  href,
  icon: Icon,
  children,
  onDone,
}: {
  href: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  children: string;
  onDone: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onDone}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-ink hover:bg-brand-500/10 focus-visible:bg-brand-500/10"
    >
      <Icon className="size-5 text-brand-600" aria-hidden />
      {children}
    </Link>
  );
}

const profileAvatarClass =
  'neu-inset flex shrink-0 items-center justify-center overflow-hidden rounded-full text-brand-700 transition-[box-shadow,filter] hover:brightness-[0.98] active:shadow-[inset_7px_7px_14px_#bcc7bc,inset_-7px_-7px_14px_#ffffff]';

function ProfileAvatar({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn(profileAvatarClass, className)} aria-hidden>
      <UserRound className={cn('size-5', iconClassName)} strokeWidth={2} />
    </span>
  );
}

/** The profile picture in the header; opens the account menu: profile, settings, help, log out. */
export function AccountChip() {
  const t = useT();
  const me = useMe();
  const router = useRouter();
  const signOut = useLogout();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me.data) return null;
  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t('profile.menuAccount')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(open && 'ring-2 ring-brand-500/25 ring-offset-2 ring-offset-surface')}
      >
        <ProfileAvatar className="size-10" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('profile.menuAccount')}
          className="neu-card absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl p-2"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={close}
            className="mb-1 flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-brand-500/10 focus-visible:bg-brand-500/10"
          >
            <ProfileAvatar className="size-11" iconClassName="size-6" />
            <span className="min-w-0">
              <span className="block truncate font-bold text-ink">
                {me.data.name ?? t('profile.noName')}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {formatE164ForDisplay(me.data.phone)}
              </span>
            </span>
          </Link>
          <div className="my-1 h-px bg-line" />
          <Item href="/profile" icon={UserRound} onDone={close}>
            {t('nav.profile')}
          </Item>
          <Item href="/profile/settings" icon={Settings} onDone={close}>
            {t('profile.menuSettings')}
          </Item>
          <Item href="/help" icon={CircleHelp} onDone={close}>
            {t('profile.menuHelp')}
          </Item>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            disabled={signOut.isPending}
            onClick={() =>
              signOut.mutate(undefined, {
                onSettled: () => {
                  close();
                  toast(t('profile.loggedOut'));
                  router.replace('/');
                },
              })
            }
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-danger hover:bg-danger/10 focus-visible:bg-danger/10 disabled:opacity-50"
          >
            <LogOut className="size-5" aria-hidden />
            {t('profile.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
