import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { parseUsage, readUsageText, recordAppOpen, subscribeToUsage, type Usage } from '@/lib/usage';

/** The days of use of this device, live: a change in any tab shows at once. */
export function useUsage(): Usage | null {
  const text = useSyncExternalStore(
    subscribeToUsage,
    () => readUsageText(),
    () => null,
  );
  return useMemo(() => parseUsage(text), [text]);
}

/**
 * Counts the day in when the app opens, and again whenever it comes back to the screen: an
 * installed app on a phone often sleeps for days without being loaded anew.
 */
export function useRecordAppOpen(): void {
  useEffect(() => {
    recordAppOpen();
    const onVisible = () => {
      if (document.visibilityState === 'visible') recordAppOpen();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
}
