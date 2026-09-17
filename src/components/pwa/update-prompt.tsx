import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';
import { fill } from '@/features/deductions/fill';
import { useHand } from '@/hooks/use-hand';
import { ru } from '@/i18n/ru';
import { fetchLatestRelease, startUpdateChecks, type Release } from '@/lib/release';
import { cn } from '@/lib/utils';

/** The pages of the site have no column of tabs; every other page of a phone has it on one side. */
const SITE_PAGES = new Set(['/', '/privacy', '/welcome']);

/**
 * vite-plugin-pwa runs with registerType: 'prompt', so the user decides when the
 * new version is applied — a reload must never interrupt data entry.
 */
export function UpdatePrompt() {
  const stopChecks = useRef<(() => void) | null>(null);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app may stay open for days: it looks for a new version itself.
    onRegisteredSW(swUrl, registration) {
      if (registration && !stopChecks.current) stopChecks.current = startUpdateChecks(registration, swUrl);
    },
  });
  const [release, setRelease] = useState<Release | null>(null);
  const { pathname } = useLocation();
  const hand = useHand();

  useEffect(() => () => stopChecks.current?.(), []);

  // What the waiting version is and brings, when the site says so.
  useEffect(() => {
    if (!needRefresh) return;
    let active = true;
    void fetchLatestRelease().then((latest) => {
      if (active && latest && latest.version !== __APP_VERSION__) setRelease(latest);
    });
    return () => {
      active = false;
    };
  }, [needRefresh]);

  // The "ready to work offline" note is good news, not a decision: it goes away by
  // itself so that it never covers a control the user is reaching for.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 6_000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-prompt"
      className={cn(
        'fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg',
        // on a phone the column of tabs stays free
        !SITE_PAGES.has(pathname) && (hand === 'left' ? 'max-md:left-16' : 'max-md:right-16'),
      )}
    >
      {needRefresh ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold" data-testid="pwa-update-title">
              {release ? fill(ru.pwa.updateVersion, { version: release.version }) : ru.pwa.updateTitle}
            </p>
            {release && release.notes.length > 0 ? (
              <ul
                className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm"
                data-testid="pwa-update-notes"
              >
                {release.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">{ru.pwa.updateText}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" data-testid="pwa-update" onClick={() => void updateServiceWorker(true)}>
              {ru.pwa.updateAction}
            </Button>
            <Button size="sm" variant="outline" onClick={close}>
              {ru.pwa.updateLater}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">{ru.pwa.offlineReady}</p>
          <Button size="sm" variant="outline" onClick={close}>
            {ru.pwa.dismiss}
          </Button>
        </div>
      )}
    </div>
  );
}
