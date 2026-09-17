/**
 * Which hand holds the phone: the tabs of a narrow screen stand in a column on that side, under the
 * thumb. Kept on the device next to the theme, not in the database: it is about this phone, not about
 * the money, so it neither goes into a backup nor is wiped with the data.
 */

export type Hand = 'right' | 'left';

export const HAND_STORAGE_KEY = 'konvert-me.hand';
const CHANGE_EVENT = 'konvert-me:hand';

/** A choice the storage refused: this page still follows it until it is closed. */
let unsaved: Hand | null = null;

export function readHand(): Hand {
  try {
    return localStorage.getItem(HAND_STORAGE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    // private mode or blocked storage: the right hand is the usual one
    return 'right';
  }
}

export function writeHand(hand: Hand): void {
  try {
    localStorage.setItem(HAND_STORAGE_KEY, hand);
    unsaved = null;
  } catch {
    unsaved = hand;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The choice as the page sees it: what is stored, or what could not be stored this time. */
export function currentHand(): Hand {
  return unsaved ?? readHand();
}

/** Calls back when the choice changes here or in another tab of the app. */
export function subscribeHand(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === HAND_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
