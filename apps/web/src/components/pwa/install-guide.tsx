'use client';

import {
  CheckCircle2,
  Download,
  MonitorSmartphone,
  Share,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import { usePwaInstall } from '@/lib/pwa-install';
import type { MessageKey } from '@/i18n/translate';

function Steps({
  title,
  steps,
  mine,
  icon: Icon,
}: {
  title: string;
  steps: string[];
  mine: boolean;
  icon: typeof Smartphone;
}) {
  const t = useT();
  return (
    <section className={cn('neu-card rounded-xl p-6', mine && 'border-2 border-brand-500/60')}>
      <h3 className="mb-4 flex items-center gap-3 text-lg font-bold text-ink">
        <Icon className="size-6 text-brand-600" aria-hidden />
        {title}
        {mine && (
          <span className="ml-auto rounded-full bg-brand-500/15 px-3 py-0.5 text-2xs font-bold uppercase tracking-wider text-brand-700">
            {t('install.thisDevice')}
          </span>
        )}
      </h3>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3">
            <span className="neu-inset flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-brand-700">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-ink">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The install button when the browser allows it, and plain steps for each kind of phone. */
export function InstallGuide() {
  const t = useT();
  const install = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const desktop = !install.ios && !install.android;

  const key = (k: string) => t(`install.${k}` as MessageKey);

  return (
    <div className="space-y-8">
      {install.installed ? (
        <div className="neu-card flex items-center gap-4 rounded-xl p-6">
          <CheckCircle2 className="size-10 shrink-0 text-brand-600" aria-hidden />
          <div>
            <p className="text-lg font-bold text-ink">{t('install.installed')}</p>
            <p className="text-sm text-ink-muted">{t('install.installedBody')}</p>
          </div>
        </div>
      ) : install.canPrompt ? (
        <Button
          type="button"
          size="lg"
          loading={busy}
          className="sm:w-auto sm:px-12"
          onClick={async () => {
            setBusy(true);
            await install.prompt();
            setBusy(false);
          }}
        >
          <Download className="size-5" aria-hidden />
          {busy ? t('install.installing') : t('install.installNow')}
        </Button>
      ) : null}

      {!install.secure && !install.installed && (
        <div
          role="note"
          className="flex gap-4 rounded-xl border-l-4 border-warning bg-warning-bg p-5"
        >
          <ShieldAlert className="size-6 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-bold text-warning">{t('install.insecureTitle')}</p>
            <p className="mt-1 text-sm text-ink">{t('install.insecureBody')}</p>
          </div>
        </div>
      )}

      {!install.installed && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-ink">{t('install.stepsTitle')}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Steps
              title={t('install.iosTitle')}
              icon={Share}
              mine={install.ios}
              steps={[key('iosStep1'), key('iosStep2'), key('iosStep3')]}
            />
            <Steps
              title={t('install.androidTitle')}
              icon={Smartphone}
              mine={install.android}
              steps={[key('androidStep1'), key('androidStep2'), key('androidStep3')]}
            />
          </div>
          {desktop && (
            <p className="flex items-start gap-3 text-sm text-ink-muted">
              <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              {t('install.desktopBody')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
