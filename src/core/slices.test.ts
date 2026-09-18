import { describe, expect, it } from 'vitest';

import { sharePercent, sliceTotalMinor, topSlices } from './slices';

const slice = (key: string, amountMinor: number) => ({ key, amountMinor });

describe('topSlices', () => {
  it('keeps everything while the parts are few, biggest first', () => {
    expect(topSlices([slice('a', 100), slice('b', 300), slice('c', 200)])).toEqual([
      slice('b', 300),
      slice('c', 200),
      slice('a', 100),
    ]);
  });

  it('gathers the tail into one part and loses nothing', () => {
    const many = Array.from({ length: 10 }, (_, index) => slice(`c${index}`, (10 - index) * 100));
    const drawn = topSlices(many, { limit: 3 });

    expect(drawn).toHaveLength(4);
    expect(drawn[3].key).toBe('rest');
    expect(sliceTotalMinor(drawn)).toBe(sliceTotalMinor(many));
  });

  it('leaves out what is zero or below', () => {
    expect(topSlices([slice('a', 0), slice('b', -500), slice('c', 700)])).toEqual([slice('c', 700)]);
  });

  it('names the tail as asked', () => {
    const drawn = topSlices([slice('a', 3), slice('b', 2), slice('c', 1)], { limit: 1, restKey: 'прочее' });
    expect(drawn[1]).toEqual(slice('прочее', 3));
  });
});

describe('sharePercent', () => {
  it('counts the share of the whole', () => {
    expect(sharePercent(250, 1_000)).toBe(25);
  });

  it('gives zero when there is no whole', () => {
    expect(sharePercent(250, 0)).toBe(0);
  });
});
