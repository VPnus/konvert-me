import { SOURCES } from './sources';
import type { RuYearRules } from './types';

/** The day every norm below was read from its source. */
const CHECKED = '2026-09-16';

/**
 * 2023 is kept for the refunds that can still be claimed for it. Several limits were
 * lower then, and a year counted by later rules would promise money that is not due.
 */
export const RU_RULES_2023: RuYearRules = {
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

  lifeInsuranceInLongTermSavings: {
    value: false,
    source: SOURCES.lifeInsuranceLongTerm,
    checkedAt: CHECKED,
    note:
      'Взносы по страхованию жизни — только в социальном вычете, в общем лимите с лечением и учёбой. ' +
      'В вычет на долгосрочные сбережения они переходят с 1 сентября 2026 года.',
  },

  deductionYearsBack: {
    value: 3,
    source: SOURCES.threeYearsBack,
    checkedAt: CHECKED,
  },

  homeSale: {
    value: {
      deductionLimitMinor: 1_000_000 * 100,
      cadastralShare: 0.7,
      minimumYears: 5,
      minimumYearsSpecial: 3,
    },
    source: SOURCES.homeSale,
    checkedAt: CHECKED,
    note:
      'Вычет 1 000 000 ₽ — на все жилые дома, квартиры, комнаты, дачи и участки, проданные за год, ' +
      'вместе; при долевой собственности он делится по долям. Вместо него можно вычесть ' +
      'подтверждённые расходы на покупку — приложение берёт то, что больше. Три года владения ' +
      'хватает для жилья, полученного в наследство или в подарок от члена семьи, ' +
      'приватизированного, полученного по договору ренты, или единственного жилья; для остального ' +
      'нужно пять лет. Регион может сократить срок и коэффициент кадастровой стоимости, а семьи ' +
      'с двумя и более детьми при некоторых условиях не платят налог совсем — этого приложение ' +
      'не проверяет.',
  },

  homeSaleTaxBands: {
    value: [{ fromMinor: 0, rate: 0.13 }],
    source: SOURCES.homeSaleRate,
    checkedAt: CHECKED,
    note: 'До 2025 года доход от продажи облагался по 13 % при любой сумме и не входил в порог 5 млн ₽.',
  },

  saleIncomeInMainBase: {
    value: true,
    source: SOURCES.taxBases,
    checkedAt: CHECKED,
    note:
      'До 2025 года продажа считалась вместе с зарплатой, и любой вычет, которому не хватило ' +
      'зарплаты, уменьшал доход от продажи. Текст прежней редакции статьи 210 не сверен: значение ' +
      'взято из описаний изменений 2025 года.',
  },

  socialPaymentCertificates: {
    value: false,
    source: SOURCES.paymentCertificates,
    checkedAt: CHECKED,
    note:
      'До 2024 года расходы на лечение, обучение, спорт и ДМС подтверждали договором, лицензией ' +
      'организации и платёжными документами.',
  },

  declarationDeadline: {
    value: '04-30',
    source: SOURCES.declarationDeadline,
    checkedAt: CHECKED,
    note:
      'Срок для обязательной декларации — например, после продажи жилья раньше минимального ' +
      'срока. Декларацию только ради возврата налога можно подать в любой день в течение трёх ' +
      'лет. Если день выпадает на выходной, срок переносится на следующий рабочий день.',
  },

  taxPaymentDeadline: {
    value: '07-15',
    source: SOURCES.taxPaymentDeadline,
    checkedAt: CHECKED,
    note: 'Если день выпадает на выходной, срок переносится на следующий рабочий день.',
  },
};
