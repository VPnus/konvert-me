import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishAppEvent, subscribeToAppEvents, type AppEvent } from '@/lib/broadcast';

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A channel of its own stands for another tab: the app's channel has the same name. */
function anotherTab(): BroadcastChannel {
  const channel = new BroadcastChannel('konvert-me');
  cleanups.push(() => channel.close());
  return channel;
}

function listen(options?: Parameters<typeof subscribeToAppEvents>[1]): AppEvent[] {
  const heard: AppEvent[] = [];
  cleanups.push(subscribeToAppEvents((event) => heard.push(event), options));
  return heard;
}

describe('app events', () => {
  it('reach this tab from another one, but not from this tab itself', async () => {
    const heard = listen();

    // Dexie liveQuery already shows a change made here; hearing it again counts every screen twice.
    publishAppEvent({ type: 'data-changed' });
    anotherTab().postMessage({ type: 'data-cleared' });

    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(heard[0].type).toBe('data-cleared');
  });

  it('reach this tab from itself when asked to', async () => {
    const heard = listen({ includeThisTab: true });

    publishAppEvent({ type: 'data-changed' });
    anotherTab().postMessage({ type: 'data-cleared' });

    await vi.waitFor(() => expect(heard).toHaveLength(2));
    expect(heard.map((event) => event.type)).toEqual(['data-changed', 'data-cleared']);
  });
});
