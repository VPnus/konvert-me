import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';
import { ru } from '@/i18n/ru';

/**
 * vite-plugin-pwa runs with registerType: 'prompt', so the user decides when the
 * new version is applied — a reload must never interrupt data entry.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-6"
    >
      {needRefresh ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold">{ru.pwa.updateTitle}</p>
            <p className="text-sm text-muted-foreground">{ru.pwa.updateText}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void updateServiceWorker(true)}>
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
