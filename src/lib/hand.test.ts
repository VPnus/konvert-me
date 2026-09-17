import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentHand, HAND_STORAGE_KEY, readHand, subscribeHand, writeHand } from '@/lib/hand';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the hand that holds the phone', () => {
  it('is the right one until the person chooses the left', () => {
    expect(readHand()).toBe('right');
    writeHand('left');
    expect(localStorage.getItem(HAND_STORAGE_KEY)).toBe('left');
    expect(currentHand()).toBe('left');

    localStorage.setItem(HAND_STORAGE_KEY, 'something else');
    expect(readHand()).toBe('right');
  });

  it('tells the page at once, and hears a choice made in another tab', () => {
    const onChange = vi.fn();
    const stop = subscribeHand(onChange);

    writeHand('left');
    expect(onChange).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: HAND_STORAGE_KEY, newValue: 'right' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'konvert-me.theme', newValue: 'light' }));
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    writeHand('right');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('still follows the choice on this page when the storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    writeHand('left');
    expect(currentHand()).toBe('left');

    // once the storage takes it again, what is stored is what counts
    vi.restoreAllMocks();
    writeHand('right');
    expect(currentHand()).toBe('right');
  });
});
