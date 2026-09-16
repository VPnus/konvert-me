import { useEffect, useState } from 'react';

import { subscribeToAppEvents, type SubscribeOptions } from '@/lib/broadcast';

/**
 * Grows by one on every change made in another tab. Queries depend on it, so an edit,
 * an import or a wipe in one tab is visible in all the others. Changes made in this
 * tab count only when asked for: see SubscribeOptions.
 */
export function useDataVersion(options: SubscribeOptions = {}): number {
  const [version, setVersion] = useState(0);
  const { includeThisTab } = options;

  useEffect(
    () =>
      subscribeToAppEvents(
        () => {
          setVersion((current) => current + 1);
        },
        { includeThisTab },
      ),
    [includeThisTab],
  );

  return version;
}
