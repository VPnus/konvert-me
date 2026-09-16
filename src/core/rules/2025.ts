import { SOURCES } from './sources';
import type { YearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-16';

/** 2025: the five-step tax scale, and larger child deductions for everyone. */
export const RULES_2025: YearRules = {
  year: 2025,
  depositInsuranceLimitMinor: {
    value: 1_400_000 * 100,
    source: SOURCES.depositInsuranceHistory,
    checkedAt: CHECKED,
    note: 'Базовый лимит на одного человека в одном банке, действует с конца 2014 года.',
  },

  incomeTaxBands: {
    value: [
      { fromMinor: 0, rate: 0.13 },
      { fromMinor: 2_400_000 * 100, rate: 0.15 },
      { fromMinor: 5_000_000 * 100, rate: 0.18 },
      { fromMinor: 20_000_000 * 100, rate: 0.2 },
      { fromMinor: 50_000_000 * 100, rate: 0.22 },
    ],
    source: SOURCES.incomeTaxFiveSteps,
    checkedAt: CHECKED,
    note: 'Первый год пяти ступеней; повышенная ставка — только с суммы превышения.',
  },

  socialDeductionLimitMinor: {
    value: 150_000 * 100,
    source: SOURCES.socialDeductions,
    checkedAt: CHECKED,
    note: 'Обучение детей и дорогостоящее лечение — вне этого лимита.',
  },

  childEducationLimitMinor: {
    value: 110_000 * 100,
    source: SOURCES.schooling,
    checkedAt: CHECKED,
    note: 'На каждого ребёнка, на обоих родителей вместе.',
  },

  childDeduction: {
    value: {
      firstMinor: 1_400 * 100,
      secondMinor: 2_800 * 100,
      thirdAndOnMinor: 6_000 * 100,
      disabledParentMinor: 12_000 * 100,
      disabledGuardianMinor: 12_000 * 100,
      incomeCapMinor: 450_000 * 100,
    },
    source: SOURCES.childDeductionsFrom2025,
    checkedAt: CHECKED,
    note:
      'Суммы за месяц. С 2025 года опекун получает за ребёнка-инвалида столько же, сколько ' +
      'родитель, а работодатель применяет вычет сам, без ежегодного заявления.',
  },

  longTermSavingsLimitMinor: {
    value: 400_000 * 100,
    source: SOURCES.longTermSavings,
    checkedAt: CHECKED,
    note: 'Один лимит на ИИС-3, программу долгосрочных сбережений и негосударственную пенсию.',
  },

  deductionYearsBack: {
    value: 3,
    source: SOURCES.threeYearsBack,
    checkedAt: CHECKED,
  },
};
