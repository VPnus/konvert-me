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
    note: 'Один лимит на ИИС-3, программу долгосрочных сбережений и негосударственную пенсию.',
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
    value: [
      { fromMinor: 0, rate: 0.13 },
      { fromMinor: 2_400_000 * 100, rate: 0.15 },
    ],
    source: SOURCES.homeSaleRate,
    checkedAt: CHECKED,
    note:
      'Порог 2,4 млн ₽ считается по сумме за год доходов от продажи имущества, подарков, процентов ' +
      'по вкладам, дивидендов и операций с ценными бумагами. Приложение знает только о продаже ' +
      'жилья: если были и другие такие доходы, налог может оказаться выше.',
  },

  saleIncomeInMainBase: {
    value: false,
    source: SOURCES.taxBases,
    checkedAt: CHECKED,
    note:
      'С 2025 года продажа — отдельная налоговая база. На неё переходит только та часть вычета ' +
      'на детей, социальных вычетов и вычета за покупку жилья и проценты, которой не хватило ' +
      'основного дохода. Вычет на ИИС и долгосрочные сбережения на неё не переходит.',
  },

  socialPaymentCertificates: {
    value: true,
    source: SOURCES.paymentCertificates,
    checkedAt: CHECKED,
    note:
      'С расходов 2024 года за лечение, обучение, спорт и ДМС достаточно одной справки об оплате ' +
      'от клиники, учебного заведения, спортивной или страховой организации. Её не нужно ' +
      'прикладывать, если организация сама передала сведения в налоговую. Для лекарств по-прежнему ' +
      'нужны рецепт и чеки.',
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
