import { describe, expect, it } from 'vitest';

import {
  ASSET_CLASSES,
  RISK_PROFILES,
  horizonBand,
  splitByClasses,
  strategicAllocation,
  type AssetShares,
} from './portfolio';

const shares = (stocks: number, bonds: number, realEstate: number, gold: number): AssetShares => ({
  stocks,
  bonds,
  realEstate,
  gold,
});

describe('portfolio: the horizon of a goal', () => {
  it('falls into the four terms of the allocation table', () => {
    expect(horizonBand(1)).toBe('upTo5');
    expect(horizonBand(60)).toBe('upTo5');
    expect(horizonBand(61)).toBe('from5To10');
    expect(horizonBand(120)).toBe('from5To10');
    expect(horizonBand(121)).toBe('from10To15');
    expect(horizonBand(180)).toBe('from10To15');
    expect(horizonBand(181)).toBe('over15');
  });

  it('treats a term that has already come as the shortest one', () => {
    expect(horizonBand(0)).toBe('upTo5');
    expect(horizonBand(-3)).toBe('upTo5');
  });
});

describe('portfolio: strategic allocation', () => {
  it('up to 5 years', () => {
    expect(strategicAllocation(48, 'conservative')).toEqual(shares(10, 90, 0, 0));
    expect(strategicAllocation(48, 'moderate')).toEqual(shares(10, 80, 5, 5));
    expect(strategicAllocation(48, 'aggressive')).toEqual(shares(20, 70, 5, 5));
  });

  it('5 to 10 years', () => {
    expect(strategicAllocation(96, 'conservative')).toEqual(shares(30, 60, 5, 5));
    expect(strategicAllocation(96, 'moderate')).toEqual(shares(40, 50, 5, 5));
    expect(strategicAllocation(96, 'aggressive')).toEqual(shares(60, 30, 5, 5));
  });

  it('10 to 15 years', () => {
    expect(strategicAllocation(150, 'conservative')).toEqual(shares(40, 50, 5, 5));
    expect(strategicAllocation(150, 'moderate')).toEqual(shares(60, 30, 5, 5));
    expect(strategicAllocation(150, 'aggressive')).toEqual(shares(80, 10, 5, 5));
  });

  it('over 15 years', () => {
    expect(strategicAllocation(264, 'conservative')).toEqual(shares(50, 40, 5, 5));
    expect(strategicAllocation(264, 'moderate')).toEqual(shares(70, 20, 5, 5));
    expect(strategicAllocation(264, 'aggressive')).toEqual(shares(90, 5, 2.5, 2.5));
  });

  it('always adds up to 100 %', () => {
    for (const months of [12, 96, 150, 264]) {
      for (const profile of RISK_PROFILES) {
        const allocation = strategicAllocation(months, profile);
        expect(ASSET_CLASSES.reduce((total, asset) => total + allocation[asset], 0)).toBe(100);
      }
    }
  });
});

describe('portfolio: a sum split by the classes', () => {
  it('gives every kopeck to some class', () => {
    const split = splitByClasses(4_196_608, shares(40, 50, 5, 5));
    // Real estate and gold are left with the same 0.4 kopeck: the class listed first gets it.
    expect(split).toEqual({ stocks: 1_678_643, bonds: 2_098_304, realEstate: 209_831, gold: 209_830 });
    expect(Object.values(split).reduce((total, value) => total + value, 0)).toBe(4_196_608);
  });

  it('splits halves of a percent too', () => {
    const split = splitByClasses(100_001, shares(90, 5, 2.5, 2.5));
    expect(Object.values(split).reduce((total, value) => total + value, 0)).toBe(100_001);
    expect(split.stocks).toBe(90_001);
  });

  it('leaves nothing to a class with no share', () => {
    expect(splitByClasses(10_000, shares(10, 90, 0, 0))).toEqual({
      stocks: 1_000,
      bonds: 9_000,
      realEstate: 0,
      gold: 0,
    });
  });
});
