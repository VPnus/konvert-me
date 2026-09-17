import { describe, expect, it } from 'vitest';

import type { PilotCounts } from '@/db/repositories/pilot';
import { buildPilotStats, type PilotStatsInput } from '@/features/settings/pilot-stats';
import { startUsage, withOnboarding, withOpenDay, type Usage } from '@/lib/usage';

const COUNTS: PilotCounts = {
  goals: 2,
  accounts: 4,
  operations: 186,
  importedOperations: 120,
  budgetMonths: 2,
  deductionYears: 1,
  planCalculations: 1,
};

function usageOn(days: readonly string[], patch: Partial<Usage> = {}): Usage {
  let usage: Usage | null = null;
  for (const day of days) usage = withOpenDay(usage, day, false);
  return { ...usage!, ...patch };
}

function input(patch: Partial<PilotStatsInput> = {}): PilotStatsInput {
  return {
    version: '0.17.0',
    today: '2026-10-21',
    usage: usageOn(['2026-09-17', '2026-09-18', '2026-09-26', '2026-10-21'], {
      onboarding: 'completed',
      installed: true,
    }),
    onboardingDone: true,
    counts: COUNTS,
    backupDone: true,
    narrowScreen: true,
    ...patch,
  };
}

describe('the stats of the pilot', () => {
  it('say how long and how the app was used, a fact a line', () => {
    expect(buildPilotStats(input()).text).toBe(
      [
        'Конверкот 0.17.0, статистика пилота',
        'Дней с первого запуска: 34',
        'Дни, когда открывали (первый считается нулевым): 0, 1, 9, 34',
        'Открывали через 7 дней и позже: да',
        'Открывали через 30 дней и позже: да',
        'Знакомство: пройдено',
        'Целей, кроме резерва: 2',
        'Счетов и долгов: 4',
        'Операций: 186, из выписок: 120',
        'Месяцев с планом бюджета: 2',
        'Лет во «Вычетах»: 1',
        'Расчётов в «Финплане»: 1',
        'Резервная копия: сохраняли',
        'Открывали как установленное приложение: да',
        'Экран: телефон',
        'Строка для таблицы: 0.17.0;34;0 1 9 34;да;да;пройдено;2;4;186;120;2;1;1;сохраняли;да;телефон',
      ].join('\n'),
    );
  });

  it('keep the values for a spreadsheet in one line, in the order of the text', () => {
    const { row, text } = buildPilotStats(input());

    expect(row.split(';')).toHaveLength(16);
    expect(text.endsWith(row)).toBe(true);
  });

  it('do not say "no" before the day has come', () => {
    const { text } = buildPilotStats(
      input({
        today: '2026-09-20',
        usage: withOnboarding(startUsage('2026-09-17'), 'skipped', '2026-09-17'),
        backupDone: false,
        narrowScreen: false,
      }),
    );

    expect(text).toContain('Дней с первого запуска: 3');
    expect(text).toContain('Открывали через 7 дней и позже: ещё рано');
    expect(text).toContain('Открывали через 30 дней и позже: ещё рано');
    expect(text).toContain('Знакомство: пропущено');
    expect(text).toContain('Резервная копия: не сохраняли');
    expect(text).toContain('Экран: компьютер или планшет');
  });

  it('say "no" for someone who has not come back since the first days', () => {
    const { text } = buildPilotStats(input({ usage: usageOn(['2026-09-17', '2026-09-19']) }));

    expect(text).toContain('Открывали через 7 дней и позже: нет');
    expect(text).toContain('Открывали через 30 дней и позже: нет');
  });

  it('tell an onboarding from before the counting from one not passed', () => {
    expect(buildPilotStats(input({ usage: null })).text).toContain('Знакомство: пройдено до начала учёта');
    expect(buildPilotStats(input({ usage: null, onboardingDone: false })).text).toContain(
      'Знакомство: не пройдено',
    );
  });

  it('admit what they do not know when the storage kept no days', () => {
    const { text, row } = buildPilotStats(input({ usage: null }));

    expect(text).toContain('Дней с первого запуска: нет данных');
    expect(text).toContain('Дни, когда открывали (первый считается нулевым): нет данных');
    expect(text).toContain('Открывали как установленное приложение: нет данных');
    expect(row.startsWith('0.17.0;нет данных;;нет данных;нет данных;')).toBe(true);
  });

  it('carry no sums', () => {
    expect(buildPilotStats(input()).text).not.toMatch(/₽|руб/);
  });
});
