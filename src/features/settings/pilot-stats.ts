import type { IsoDate } from '@/core/time';
import type { PilotCounts } from '@/db/repositories/pilot';
import { fill, strings } from '@/i18n';
import { dayNumbers, daysSinceFirst, type Usage } from '@/lib/usage';

/** The anchor of the pilot card on the settings page: the reminder above the page leads to it. */
export const PILOT_CARD_ID = 'pilot';

/**
 * The stats a participant of the pilot may copy and send: how long and how the app was used, never
 * what is in it. Nothing here leaves the device unless the user pastes it somewhere.
 */
export interface PilotStatsInput {
  readonly version: string;
  readonly today: IsoDate;
  readonly usage: Usage | null;
  readonly onboardingDone: boolean;
  readonly counts: PilotCounts;
  readonly backupDone: boolean;
  readonly narrowScreen: boolean;
}

export interface PilotStats {
  /** What the user reads and copies, one fact a line. */
  readonly text: string;
  /** The same values in one line split by «;», to paste into a spreadsheet (docs/PILOT.md). */
  readonly row: string;
}

const t = strings.settings.pilot.stats;

/**
 * Whether the app was opened that many days after the first one or later. Before the day comes
 * the answer is not "no" yet. Today counts: the stats are copied on a day of use.
 */
function returnedAfter(usage: Usage | null, today: IsoDate, days: number): string {
  if (!usage) return t.unknown;
  if (dayNumbers(usage).some((number) => number >= days)) return t.yes;
  return daysSinceFirst(usage, today) >= days ? t.no : t.tooEarly;
}

/** The record of how the onboarding ended is newer than the onboarding, hence the third answer. */
function onboardingOf(usage: Usage | null, onboardingDone: boolean): string {
  if (usage?.onboarding === 'completed') return t.onboardingCompleted;
  if (usage?.onboarding === 'skipped') return t.onboardingSkipped;
  return onboardingDone ? t.onboardingBefore : t.onboardingNot;
}

export function buildPilotStats(input: PilotStatsInput): PilotStats {
  const { usage, counts } = input;
  const days = usage ? String(daysSinceFirst(usage, input.today)) : t.unknown;
  const numbers = usage ? dayNumbers(usage) : null;
  const returned7 = returnedAfter(usage, input.today, 7);
  const returned30 = returnedAfter(usage, input.today, 30);
  const onboarding = onboardingOf(usage, input.onboardingDone);
  const backup = input.backupDone ? t.backupDone : t.backupNever;
  const installed = usage ? (usage.installed ? t.yes : t.no) : t.unknown;
  const screen = input.narrowScreen ? t.screenNarrow : t.screenWide;

  const row = [
    input.version,
    days,
    numbers ? numbers.join(' ') : '',
    returned7,
    returned30,
    onboarding,
    counts.goals,
    counts.accounts,
    counts.operations,
    counts.importedOperations,
    counts.budgetMonths,
    counts.deductionYears,
    counts.planCalculations,
    backup,
    installed,
    screen,
  ].join(';');

  const lines = [
    fill(t.header, { version: input.version }),
    fill(t.days, { value: days }),
    fill(t.dayNumbers, { value: numbers ? numbers.join(', ') : t.unknown }),
    fill(t.returned7, { value: returned7 }),
    fill(t.returned30, { value: returned30 }),
    fill(t.onboarding, { value: onboarding }),
    fill(t.goals, { value: counts.goals }),
    fill(t.accounts, { value: counts.accounts }),
    fill(t.operations, { value: counts.operations, imported: counts.importedOperations }),
    fill(t.budgetMonths, { value: counts.budgetMonths }),
    fill(t.deductionYears, { value: counts.deductionYears }),
    fill(t.planCalculations, { value: counts.planCalculations }),
    fill(t.backup, { value: backup }),
    fill(t.installed, { value: installed }),
    fill(t.screen, { value: screen }),
    fill(t.row, { value: row }),
  ];

  return { text: lines.join('\n'), row };
}
