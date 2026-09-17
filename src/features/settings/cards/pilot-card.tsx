import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { SITE } from '@/app/site';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayIso } from '@/core/time';
import { countForPilot, type PilotCounts } from '@/db/repositories/pilot';
import { buildPilotStats, PILOT_CARD_ID } from '@/features/settings/pilot-stats';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettings } from '@/hooks/use-settings';
import { useUsage } from '@/hooks/use-usage';
import { ru } from '@/i18n/ru';
import { copyText } from '@/lib/clipboard';
import { recordShared } from '@/lib/usage';

/** The width below which the tab bar keeps one name only: what the stats call a phone. */
const NARROW_SCREEN = '(max-width: 767px)';

/**
 * The stats of the pilot, shown whole before anything is copied: the user sees every word that
 * would leave the device, and nothing leaves it unless they paste it somewhere themselves.
 */
export function PilotCard() {
  const usage = useUsage();
  const settings = useSettings();
  const dataVersion = useDataVersion({ includeThisTab: true });
  const { hash } = useLocation();
  const [counts, setCounts] = useState<PilotCounts | null>(null);
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const scrolledTo = useRef('');

  useEffect(() => {
    let active = true;
    void countForPilot().then((next) => {
      if (active) setCounts(next);
    });
    return () => {
      active = false;
    };
  }, [dataVersion]);

  // The reminder above the page leads here; the card is scrolled to once it has its full height.
  useEffect(() => {
    if (hash !== `#${PILOT_CARD_ID}` || counts === null || scrolledTo.current === hash) return;
    scrolledTo.current = hash;
    document.getElementById(PILOT_CARD_ID)?.scrollIntoView({ block: 'start' });
  }, [hash, counts]);

  if (!SITE.pilotActive) return null;

  const stats = counts
    ? buildPilotStats({
        version: __APP_VERSION__,
        today: todayIso(),
        usage,
        onboardingDone: settings.onboardingDone,
        counts,
        backupDone: settings.lastBackupAt !== null,
        narrowScreen: window.matchMedia?.(NARROW_SCREEN).matches ?? false,
      })
    : null;

  const copy = async () => {
    if (!stats) return;
    const done = await copyText(stats.text);
    setCopied(done ? 'done' : 'failed');
    if (done) recordShared();
  };

  return (
    <Card id={PILOT_CARD_ID} className="scroll-mt-32" data-testid="pilot-card">
      <CardHeader>
        <CardTitle>{ru.settings.pilot.title}</CardTitle>
        <CardDescription>{ru.settings.pilot.text}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre
          data-testid="pilot-stats"
          className="rounded-lg border border-border bg-muted/40 p-3 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap sm:text-sm"
        >
          {stats ? stats.text : ru.settings.pilot.counting}
        </pre>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!stats} onClick={() => void copy()} data-testid="pilot-copy">
            <Copy className="size-4" aria-hidden />
            {ru.settings.pilot.copy}
          </Button>
          {SITE.feedbackFormUrl ? (
            <a
              href={SITE.feedbackFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline' })}
              data-testid="pilot-form"
            >
              {ru.settings.pilot.form}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>

        <p role="status" data-testid="pilot-copy-status" className="text-sm empty:hidden">
          {copied === 'done'
            ? ru.settings.pilot.copied
            : copied === 'failed'
              ? ru.settings.pilot.copyFailed
              : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          {SITE.feedbackFormUrl ? ru.settings.pilot.sendToForm : ru.settings.pilot.sendToInviter}
        </p>
      </CardContent>
    </Card>
  );
}
