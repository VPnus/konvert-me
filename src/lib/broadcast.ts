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

export function publishAppEvent(event: AppEvent): void {
  channel()?.postMessage(event);
}

export function subscribeToAppEvents(listener: (event: AppEvent) => void): () => void {
  const local = createChannel();
  if (!local) return () => undefined;

  const handler = (message: MessageEvent<AppEvent>) => listener(message.data);
  local.addEventListener('message', handler);

  return () => {
    local.removeEventListener('message', handler);
    local.close();
  };
}
