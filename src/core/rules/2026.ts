import type { YearRules } from './types';

export const RULES_2026: YearRules = {
  year: 2026,
  depositInsuranceLimitMinor: {
    value: 1_400_000 * 100,
    source: 'https://www.klerk.ru/buh/articles/657251/',
    checkedAt: '2026-09-16',
    note:
      'Базовый лимит на одного человека в одном банке. Для счетов эскроу по недвижимости, ' +
      'счетов фонда капремонта и денег по особым обстоятельствам (наследство, продажа жилья, ' +
      'судебные выплаты) предел выше — 10 млн ₽; приложение такие случаи не распознаёт.',
  },
};
