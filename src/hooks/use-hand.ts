import { useSyncExternalStore } from 'react';

import { currentHand, subscribeHand, type Hand } from '@/lib/hand';

/** The hand the tabs of a phone follow, live: a choice in the settings moves them at once. */
export function useHand(): Hand {
  return useSyncExternalStore(subscribeHand, currentHand, () => 'right');
}
