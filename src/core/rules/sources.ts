/**
 * The pages the norms were read from. One page often answers for several years, so
 * the addresses live here once instead of being copied into every year.
 */

export const SOURCES = {
  /** Deposit insurance: the base limit per person per bank. */
  depositInsurance: 'https://www.klerk.ru/buh/articles/657251/',
  depositInsuranceHistory:
    'https://ru.wikipedia.org/wiki/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0_%D1%81%D1%82%D1%80%D0%B0%D1%85%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F_%D0%B2%D0%BA%D0%BB%D0%B0%D0%B4%D0%BE%D0%B2',
  /** The two-step income tax scale of 2021–2024. */
  incomeTaxTwoSteps: 'https://saby.ru/articles/accounting/stavki_ndfl',
  /** The five-step income tax scale from 2025. */
  incomeTaxFiveSteps: 'https://www.consultant.ru/news/395/',
  incomeTaxFiveSteps2026:
    'https://buhguru.com/ndfl/progressivnaya-shkala-ndfl-v-2026-godu-stavki-13-15-18-20-22-i-raschyot-zarplaty.html',
  /** Tax service: social deductions and their shared limit. */
  socialDeductions: 'https://www.nalog.gov.ru/rn77/taxation/taxes/ndfl/nalog_vichet/soc_nv/',
  /** Tax service: schooling, with the limit per child and a worked example. */
  schooling: 'https://www.nalog.gov.ru/rn77/taxation/taxes/ndfl/nalog_vichet/soc_nv/soc_nv_ob/',
  /** Child deductions before and after 2025, including a disabled child. */
  childDeductionsBefore2025: 'https://www.nalogia.ru/article/163-nalogovyy-vychet-na-rebenka-invalida/',
  /** Tax code, art. 218, the edition in force from 2025. */
  childDeductionsFrom2025: 'https://rulaws.ru/nk-rf-chast-2/Razdel-VIII/Glava-23/Statya-218/',
  /** Tax code, art. 219.1: the investment account of type A, opened before 2024. */
  investmentAccountTypeA: 'https://pravo.ppt.ru/kodeks/nk/st-219.1',
  /** Tax code, art. 219.2: one limit for all long-term savings, from 2024. */
  longTermSavings: 'https://pravo.ppt.ru/kodeks/nk/st-219.2',
  /** Tax code, art. 220: property deductions, their limits and how the rest moves on. */
  property: 'https://pravo.ppt.ru/kodeks/nk/st-220',
  /** Tax service: a deduction can be claimed within three years after the year. */
  threeYearsBack: 'https://www.nalog.gov.ru/rn53/news/activities_fts/16256762/',
} as const;
