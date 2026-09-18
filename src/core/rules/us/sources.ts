/** The pages the norms of the United States were read from. */

export const SOURCES = {
  /** FDIC: $250,000 per depositor, per insured bank, for each account ownership category. */
  depositInsurance: 'https://www.fdic.gov/resources/deposit-insurance/understanding-deposit-insurance',
  /** IRS newsroom: the 401(k) and IRA limits of 2026 and their catch-up contributions. */
  retirementLimits2026:
    'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500',
  /** Rev. Proc. 2025-19: the HSA limits of 2026 and what makes a high deductible health plan. */
  hsaLimits2026: 'https://www.irs.gov/pub/irs-drop/rp-25-19.pdf',
  /** Internal Revenue Code § 223(b)(3): the catch-up of $1,000 from 55, written into the law. */
  hsaCatchUp: 'https://www.law.cornell.edu/uscode/text/26/223',
  /** Rev. Proc. 2025-32 § 4.42: the first $19,000 of gifts to one person in 2026 are not taxable gifts. */
  giftExclusion2026: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
} as const;
