import { describe, expect, it } from 'vitest';

import {
  TimeError,
  addMonths,
  assertIsoDate,
  assertIsoMonth,
  compareMonths,
  currentMonth,
  isIsoDate,
  isIsoMonth,
  monthOfDate,
  monthsBetween,
  monthsOfYear,
  monthsRange,
  todayIso,
  yearOfMonth,
} from './time';

describe('time: validation', () => {
  it('recognises YYYY-MM months', () => {
    expect(isIsoMonth('2026-01')).toBe(true);
    expect(isIsoMonth('2026-12')).toBe(true);
    expect(isIsoMonth('2026-13')).toBe(false);
    expect(isIsoMonth('2026-00')).toBe(false);
    expect(isIsoMonth('2026-1')).toBe(false);
    expect(isIsoMonth('2026-01-01')).toBe(false);
    expect(isIsoMonth(202601)).toBe(false);
  });

  it('recognises YYYY-MM-DD dates and rejects impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-1-1')).toBe(false);
    expect(isIsoDate(20260101)).toBe(false);
  });

  it('throws TimeError with the field name', () => {
    expect(() => assertIsoMonth('2026-13', 'targetMonth')).toThrow(TimeError);
    expect(() => assertIsoMonth('2026-13', 'targetMonth')).toThrow(/targetMonth/);
    expect(() => assertIsoDate('2026-02-30', 'date')).toThrow(TimeError);
  });
});

describe('time: arithmetic', () => {
  it('counts months between two months (formula 1)', () => {
    expect(monthsBetween('2026-01', '2029-01')).toBe(36);
    expect(monthsBetween('2026-01', '2031-01')).toBe(60);
    expect(monthsBetween('2026-09', '2026-09')).toBe(0);
    expect(monthsBetween('2029-01', '2026-01')).toBe(-36);
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
  });

  it('extracts the month of a date', () => {
    expect(monthOfDate('2026-03-15')).toBe('2026-03');
    expect(() => monthOfDate('2026-03')).toThrow(TimeError);
  });

  it('shifts months across year boundaries', () => {
    expect(addMonths('2026-09', 4)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-01', 0)).toBe('2026-01');
    expect(addMonths('2026-01', 36)).toBe('2029-01');
    expect(() => addMonths('2026-01', 1.5)).toThrow(TimeError);
  });

  it('compares and lists months', () => {
    expect(compareMonths('2026-01', '2026-02')).toBeLessThan(0);
    expect(compareMonths('2026-02', '2026-01')).toBeGreaterThan(0);
    expect(compareMonths('2026-02', '2026-02')).toBe(0);
    expect(monthsRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monthsRange('2026-11', '2026-10')).toEqual([]);
    expect(monthsOfYear(2026)).toHaveLength(12);
    expect(monthsOfYear(2026)[0]).toBe('2026-01');
    expect(monthsOfYear(2026)[11]).toBe('2026-12');
    expect(yearOfMonth('2026-09')).toBe(2026);
    expect(() => monthsOfYear(2026.5)).toThrow(TimeError);
  });
});

describe('time: current moment uses local calendar, never UTC shifts', () => {
  it('reads the local date of the given instant', () => {
    const lateEvening = new Date(2026, 0, 31, 23, 30, 0);
    expect(todayIso(lateEvening)).toBe('2026-01-31');
    expect(currentMonth(lateEvening)).toBe('2026-01');
  });

  it('pads single digit months and days', () => {
    expect(todayIso(new Date(2026, 8, 5))).toBe('2026-09-05');
    expect(currentMonth(new Date(2026, 8, 5))).toBe('2026-09');
  });
});
