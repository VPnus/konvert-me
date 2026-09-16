import type { YearRules } from './types';

/** The day every norm below was read from its source and compared with the law. */
const CHECKED = '2026-09-16';

export const RULES_2026: YearRules = {
  year: 2026,
  depositInsuranceLimitMinor: {
    value: 1_400_000 * 100,
    source: 'https://www.klerk.ru/buh/articles/657251/',
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
    source:
      'https://buhguru.com/ndfl/progressivnaya-shkala-ndfl-v-2026-godu-stavki-13-15-18-20-22-i-raschyot-zarplaty.html',
    checkedAt: CHECKED,
    note:
      'Повышенная ставка берётся только с суммы превышения, а не со всего дохода. ' +
      'Шкала для зарплаты и подобных доходов резидента; для дивидендов, продажи имущества ' +
      'и выигрышей действуют свои правила, которые приложение не считает.',
  },

  socialDeductionLimitMinor: {
    value: 150_000 * 100,
    source: 'https://www.nalog.gov.ru/rn77/taxation/taxes/ndfl/nalog_vichet/soc_nv/',
    checkedAt: CHECKED,
    note:
      'Общий лимит расходов за год: лечение, лекарства, своё обучение, спорт, взносы ' +
      'на добровольное страхование. Вне этого лимита — обучение детей (свой предел) ' +
      'и дорогостоящее лечение (без предела, по перечню правительства).',
  },

  childEducationLimitMinor: {
    value: 110_000 * 100,
    source: 'https://www.consultant.ru/document/cons_doc_LAW_28165/946cbfc58c05e1392615a251973beb32dc79f94e/',
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
      disabledGuardianMinor: 6_000 * 100,
      incomeCapMinor: 450_000 * 100,
    },
    source: 'https://www.consultant.ru/document/cons_doc_LAW_67988/1878daa4c7e6ae10e61dcef3e3c28af97607e084/',
    checkedAt: CHECKED,
    note:
      'Суммы за месяц. Единственному родителю — вдвое больше. Вычет за ребёнка-инвалида ' +
      'складывается с вычетом по очерёдности рождения, а не заменяет его. С 2026 года ' +
      'работодатель применяет вычет сам, заявление каждый год не нужно.',
  },

  longTermSavingsLimitMinor: {
    value: 400_000 * 100,
    source: 'https://investmint.ru/iis3/',
    checkedAt: CHECKED,
    note:
      'Один лимит на все долгосрочные сбережения вместе: взносы на ИИС-3, программу ' +
      'долгосрочных сбережений и негосударственное пенсионное обеспечение. ИИС-3, открытый ' +
      'в 2024–2026 годах, надо держать не меньше 5 лет; для открытых позже срок растёт ' +
      'до 10 лет к 2031 году.',
  },

  deductionYearsBack: {
    value: 3,
    source: 'https://www.nalog.gov.ru/rn77/taxation/taxes/ndfl/nalog_vichet/soc_nv/',
    checkedAt: CHECKED,
    note:
      'Декларацию за год можно подать в течение трёх лет после него. За более ранние годы ' +
      'вернуть уже нельзя, даже если право на вычет было.',
  },
};
