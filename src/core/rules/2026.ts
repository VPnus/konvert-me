import { SOURCES } from './sources';
import type { YearRules } from './types';

/** The day every norm below was read from its source and compared with the law. */
const CHECKED = '2026-09-16';

export const RULES_2026: YearRules = {
  year: 2026,
  depositInsuranceLimitMinor: {
    value: 1_400_000 * 100,
    source: SOURCES.depositInsurance,
    checkedAt: CHECKED,
    note:
      'Базовый лимит на одного человека в одном банке. Для счетов эскроу по недвижимости, ' +
      'счетов фонда капремонта и денег по особым обстоятельствам (наследство, продажа жилья, ' +
      'судебные выплаты) предел выше — 10 млн ₽; приложение такие случаи не распознаёт.',
  },

  incomeTaxBands: {
    value: [
      { fromMinor: 0, rate: 0.13 },
      { fromMinor: 2_400_000 * 100, rate: 0.15 },
      { fromMinor: 5_000_000 * 100, rate: 0.18 },
      { fromMinor: 20_000_000 * 100, rate: 0.2 },
      { fromMinor: 50_000_000 * 100, rate: 0.22 },
    ],
    source: SOURCES.incomeTaxFiveSteps2026,
    checkedAt: CHECKED,
    note:
      'Повышенная ставка берётся только с суммы превышения, а не со всего дохода. ' +
      'Шкала для зарплаты и подобных доходов резидента; для дивидендов, продажи имущества ' +
      'и выигрышей действуют свои правила, которые приложение не считает.',
  },

  socialDeductionLimitMinor: {
    value: 150_000 * 100,
    source: SOURCES.socialDeductions,
    checkedAt: CHECKED,
    note:
      'Общий лимит расходов за год: лечение, лекарства, своё обучение, спорт, взносы ' +
      'на добровольное страхование. Вне этого лимита — обучение детей (свой предел) ' +
      'и дорогостоящее лечение (без предела, по перечню правительства).',
  },

  childEducationLimitMinor: {
    value: 110_000 * 100,
    source: SOURCES.schooling,
    checkedAt: CHECKED,
    note:
      'На каждого ребёнка и на обоих родителей вместе, а не каждому. Только очная форма ' +
      'и возраст до 24 лет.',
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
      'Суммы за месяц. Единственному родителю — вдвое больше. Вычет за ребёнка-инвалида ' +
      'складывается с вычетом по очерёдности рождения, а не заменяет его, и с 2025 года ' +
      'одинаков для родителя и опекуна. Работодатель применяет вычет сам, без ежегодного ' +
      'заявления.',
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
    source: SOURCES.longTermSavings,
    checkedAt: CHECKED,
    note:
      'Один лимит на все долгосрочные сбережения вместе: ИИС-3, программу долгосрочных ' +
      'сбережений и негосударственную пенсию. ИИС-3, открытый в 2024–2026 годах, надо держать ' +
      'не меньше 5 лет. Редакция статьи от 1 сентября 2026 года добавляет долгосрочное ' +
      'страхование жизни и поднимает лимит до 500 000 ₽ при взносах в пользу детей; ' +
      'относится ли это ко всему 2026 году, источник не уточняет — приложение считает по 400 000 ₽.',
  },

  deductionYearsBack: {
    value: 3,
    source: SOURCES.threeYearsBack,
    checkedAt: CHECKED,
    note:
      'Декларацию за год можно подать в течение трёх лет после него. За более ранние годы ' +
      'вернуть уже нельзя, даже если право на вычет было.',
  },
};
