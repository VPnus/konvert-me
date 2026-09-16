/**
 * Events between the open tabs of the app. Row level changes are already delivered by
 * Dexie liveQuery; this channel carries the events that replace everything at once.
 */

export type AppEvent =
  | { type: 'data-changed' }
  | { type: 'data-replaced' }
  | { type: 'data-cleared' }
  | { type: 'settings-changed' };

const CHANNEL_NAME = 'konvert-me';

function createChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

let sharedChannel: BroadcastChannel | null | undefined;

function channel(): BroadcastChannel | null {
  if (sharedChannel === undefined) sharedChannel = createChannel();
  return sharedChannel;
}

/**
 * A channel hears every other channel of the same name, the ones in its own tab too.
 * The mark tells this tab's messages apart. A message without one came from a tab
 * still running an older version of the app, which is another tab all the same.
 */
const THIS_TAB = crypto.randomUUID();

type Message = AppEvent & { readonly from?: string };

export function publishAppEvent(event: AppEvent): void {
  channel()?.postMessage({ ...event, from: THIS_TAB } satisfies Message);
}

export interface SubscribeOptions {
  /**
   * Hear the changes made in this tab as well. A query does not need them — Dexie
   * liveQuery already follows its own tab, and hearing them again counts it twice —
   * but whatever lives outside the database, like the used storage, does.
   */
  readonly includeThisTab?: boolean;
}

export function subscribeToAppEvents(
  listener: (event: AppEvent) => void,
  options: SubscribeOptions = {},
): () => void {
  const local = createChannel();
  if (!local) return () => undefined;

  const handler = (message: MessageEvent<Message>) => {
    if (message.data.from === THIS_TAB && !options.includeThisTab) return;
    listener(message.data);
  };
  local.addEventListener('message', handler);

  return () => {
    local.removeEventListener('message', handler);
    local.close();
  };
}
