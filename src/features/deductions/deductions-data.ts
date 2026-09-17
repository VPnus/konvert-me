/**
 * Everything the deductions screen shows, in one read. The refund is counted by the
 * core; the screen only lays it out.
 */

import { claimableYears, summarizeDeductionYear, type DeductionSummary } from '@/core/deductions';
import { latestRules, rulesForYear, type RuYearRules } from '@/core/rules';
import { todayIso } from '@/core/time';
import type { DeductionStatus, DeductionYear, TaxDocument } from '@/db/models';
import { listDeductionYears, toDeductionClaim } from '@/db/repositories/deductions';
import { listDocuments } from '@/db/repositories/documents';

/** A year that is still going on, one a return can be filed for, or one past the three years. */
export type YearStage = 'current' | 'open' | 'expired';

export interface DeductionYearView {
  readonly year: number;
  readonly stage: YearStage;
  /** The rules the year is counted by. They carry their own year, which may be an earlier one. */
  readonly rules: RuYearRules | undefined;
  readonly saved: DeductionYear | undefined;
  readonly summary: DeductionSummary | undefined;
  readonly documents: TaxDocument[];
}

export interface DeductionsData {
  readonly currentYear: number;
  /** Newest first: the year going on, the years still open, and any older year kept. */
  readonly years: DeductionYearView[];
  readonly documentsSizeBytes: number;
}

export async function loadDeductions(now: Date = new Date()): Promise<DeductionsData> {
  const currentYear = Number(todayIso(now).slice(0, 4));
  const yearsBack = (rulesForYear('ru', currentYear) ?? latestRules('ru')).deductionYearsBack.value;
  const open = new Set(claimableYears(currentYear, yearsBack));

  const [saved, documents] = await Promise.all([listDeductionYears(), listDocuments()]);
  const savedByYear = new Map(saved.map((record) => [record.year, record]));

  // A year a person has written something for stays visible even after its time is up.
  const numbers = [...new Set([currentYear, ...open, ...savedByYear.keys()])].sort((a, b) => b - a);

  const years = numbers.map((year): DeductionYearView => {
    const rules = rulesForYear('ru', year);
    const record = savedByYear.get(year);

    return {
      year,
      stage: year >= currentYear ? 'current' : open.has(year) ? 'open' : 'expired',
      rules,
      saved: record,
      summary: rules && record ? summarizeDeductionYear(toDeductionClaim(record), rules) : undefined,
      documents: documents.filter((paper) => paper.year === year),
    };
  });

  return {
    currentYear,
    years,
    documentsSizeBytes: documents.reduce((total, paper) => total + paper.sizeBytes, 0),
  };
}

export interface YearAtGlance {
  readonly year: number;
  readonly stage: YearStage;
  readonly status: DeductionStatus;
  /** What comes back less the tax on a sale: below zero, the year owes. */
  readonly balanceMinor: number;
}

export interface DeductionsAtGlance {
  /** The years with answers that still matter: going on, or open and not yet paid back. Newest first. */
  readonly years: YearAtGlance[];
  /** What the open years still give back. The year going on is not claimable yet and is not counted. */
  readonly toComeMinor: number;
}

/** The deductions in a few lines, for the overview. */
export function deductionsAtGlance(data: DeductionsData): DeductionsAtGlance {
  const years = data.years.flatMap((view): YearAtGlance[] =>
    view.saved && view.summary && view.stage !== 'expired' && view.saved.status !== 'refunded'
      ? [
          {
            year: view.year,
            stage: view.stage,
            status: view.saved.status,
            balanceMinor: view.summary.balanceMinor,
          },
        ]
      : [],
  );

  return {
    years,
    toComeMinor: years
      .filter((item) => item.stage === 'open' && item.balanceMinor > 0)
      .reduce((total, item) => total + item.balanceMinor, 0),
  };
}
