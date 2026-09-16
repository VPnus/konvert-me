import { SOURCES } from './sources';
import type { YearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-16';

/**
 * 2023 is kept for the refunds that can still be claimed for it. Several limits were
 * lower then, and a year counted by later rules would promise money that is not due.
 */
export const RULES_2023: YearRules = {
  year: 2023,
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
    note: 'Две ступени действовали с 2021 по 2024 год; 15 % — только с суммы свыше 5 млн ₽.',
  },

  socialDeductionLimitMinor: {
    value: 120_000 * 100,
    source: SOURCES.socialDeductions,
    checkedAt: CHECKED,
    note: 'До 2024 года общий лимит был 120 000 ₽. Обучение детей и дорогостоящее лечение — вне его.',
  },

  childEducationLimitMinor: {
    value: 50_000 * 100,
    source: SOURCES.schooling,
    checkedAt: CHECKED,
    note: 'До 2024 года — 50 000 ₽ на каждого ребёнка, на обоих родителей вместе.',
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

  propertyPurchaseLimitMinor: {
    value: 2_000_000 * 100,
    source: SOURCES.property,
    checkedAt: CHECKED,
    note:
      'Один раз в жизни, но можно добирать по нескольким объектам, пока не наберётся ' +
      '2 000 000 ₽. Остаток переходит на следующие годы без срока; пенсионер может перенести ' +
      'его на три года назад.',
  },

  mortgageInterestLimitMinor: {
    value: 3_000_000 * 100,
    source: SOURCES.property,
    checkedAt: CHECKED,
    note:
      'Только по одному объекту и по кредитам, взятым с 1 января 2014 года; по более ранним ' +
      'кредитам лимита нет. Остаток на другой объект не переносится.',
  },

  longTermSavingsLimitMinor: {
    value: 400_000 * 100,
    source: SOURCES.investmentAccountTypeA,
    checkedAt: CHECKED,
    note:
      'В 2023 году общего лимита на долгосрочные сбережения ещё не было: это лимит вычета ' +
      'на взносы по ИИС типа А.',
  },

  deductionYearsBack: {
    value: 3,
    source: SOURCES.threeYearsBack,
    checkedAt: CHECKED,
  },
};
