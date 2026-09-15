import { useEffect, useState } from 'react';

import { subscribeToAppEvents } from '@/lib/broadcast';

/**
 * Grows by one on every change made in another tab. Queries depend on it, so an edit,
 * an import or a wipe in one tab is visible in all the others.
 */
export function useDataVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      subscribeToAppEvents(() => {
        setVersion((current) => current + 1);
      }),
    [],
  );

  return version;
}
