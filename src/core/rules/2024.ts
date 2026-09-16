import { SOURCES } from './sources';
import type { YearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-16';

/** 2024: the social limits went up, the child deductions and the tax scale did not yet. */
export const RULES_2024: YearRules = {
  year: 2024,
  depositInsuranceLimitMinor: {
    value: 1_400_000 * 100,
    source: SOURCES.depositInsuranceHistory,
    checkedAt: CHECKED,
    note: 'Базовый лимит на одного человека в одном банке, действует с конца 2014 года.',
  },

  incomeTaxBands: {
    value: [
      { fromMinor: 0, rate: 0.13 },
      { fromMinor: 5_000_000 * 100, rate: 0.15 },
    ],
    source: SOURCES.incomeTaxTwoSteps,
    checkedAt: CHECKED,
    note: 'Последний год двух ступеней; 15 % — только с суммы свыше 5 млн ₽.',
  },

  socialDeductionLimitMinor: {
    value: 150_000 * 100,
    source: SOURCES.socialDeductions,
    checkedAt: CHECKED,
    note: 'С расходов 2024 года лимит 150 000 ₽. Обучение детей и дорогостоящее лечение — вне его.',
  },

  childEducationLimitMinor: {
    value: 110_000 * 100,
    source: SOURCES.schooling,
    checkedAt: CHECKED,
    note: 'С 2024 года — 110 000 ₽ на каждого ребёнка, на обоих родителей вместе.',
  },

  childDeduction: {
    value: {
      firstMinor: 1_400 * 100,
      secondMinor: 1_400 * 100,
      thirdAndOnMinor: 3_000 * 100,
      disabledParentMinor: 12_000 * 100,
      disabledGuardianMinor: 6_000 * 100,
      incomeCapMinor: 350_000 * 100,
    },
    source: SOURCES.childDeductionsBefore2025,
    checkedAt: CHECKED,
    note:
      'Суммы за месяц. До 2025 года опекун, попечитель и приёмный родитель получали за ' +
      'ребёнка-инвалида вдвое меньше родителя.',
  },

  longTermSavingsLimitMinor: {
    value: 400_000 * 100,
    source: SOURCES.longTermSavings,
    checkedAt: CHECKED,
    note:
      'С 2024 года один лимит на все долгосрочные сбережения: ИИС-3, программу долгосрочных ' +
      'сбережений и негосударственную пенсию. Счета ИИС, открытые до 2024 года, получают ' +
      'вычет по прежней статье 219.1.',
  },

  deductionYearsBack: {
    value: 3,
    source: SOURCES.threeYearsBack,
    checkedAt: CHECKED,
  },
};
