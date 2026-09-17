import { describe, expect, it } from 'vitest';

import type { Account } from '@/db/models';
import {
  accountDetails,
  cardStatus,
  dateLabel,
  fullDateLabel,
  limitStatus,
  rateLabel,
} from '@/features/balance/card-view';

const RUB = 100;
const nbsp = (text: string | null | undefined) => text?.replace(/\s/g, ' ');

const platinum: Account = {
  id: 'platinum',
  name: 'Кредитка Платинум',
  side: 'liability',
  type: 'credit_card',
  currency: 'RUB',
  openingBalanceMinor: 0,
  openingDate: '2026-08-20',
  isLiquid: false,
  archived: false,
  rate: 0.499,
  paymentDay: 14,
  statementDay: 19,
  creditLimitMinor: 106_000 * RUB,
  createdAt: 1,
  updatedAt: 1,
};

describe('an account on the screen', () => {
  it('says dates in words, with the year only when it is not this one', () => {
    expect(fullDateLabel('2026-10-14')).toBe('14 октября 2026');
    expect(dateLabel('2026-10-14', '2026-09-20')).toBe('14 октября');
    expect(dateLabel('2027-01-14', '2026-12-20')).toBe('14 января 2027');
    expect(rateLabel(0.499)).toBe('49,9 %');
    expect(rateLabel(0.155)).toBe('15,5 %');
  });

  it('lists the terms of a card and the dates of a deposit or a loan in words, never as 2026-10-14', () => {
    expect(accountDetails(platinum)).toBe(
      'Кредитная карта · ставка 49,9 % · выписка 19 числа, внести до 14 числа',
    );
    expect(
      accountDetails({
        ...platinum,
        statementDay: undefined,
        paymentDay: undefined,
        gracePeriodEnd: '2026-10-14',
      }),
    ).toBe('Кредитная карта · ставка 49,9 % · льготный период до 14 октября 2026');
    expect(
      accountDetails({
        ...platinum,
        type: 'consumer',
        statementDay: undefined,
        rate: 0.219,
        paymentDay: 5,
        endDate: '2028-09-05',
      }),
    ).toBe('Потребительский кредит · ставка 21,9 % · платёж 5 числа · кредит заканчивается 5 сентября 2028');
  });

  it('says what keeps the grace period and when it is lost', () => {
    const due = cardStatus(
      {
        kind: 'due',
        statementDate: '2026-09-19',
        dueDate: '2026-10-14',
        statementMinor: 14_000 * RUB,
        paidMinor: 0,
        remainingMinor: 14_000 * RUB,
        minimumMinor: 1_120 * RUB,
      },
      '2026-10-13',
    );
    expect(nbsp(due?.text)).toBe(
      'До 14 октября внести 14 000 ₽, тогда проценты не начислят. Минимум 1 120 ₽ льготный период не сохранит.',
    );
    expect(due?.warning).toBe(false);

    const missed = cardStatus(
      {
        kind: 'missed',
        statementDate: '2026-09-19',
        dueDate: '2026-10-14',
        statementMinor: 14_000 * RUB,
        paidMinor: 5_680 * RUB,
        debtMinor: 72_320 * RUB,
        monthlyInterestMinor: 300_731,
      },
      '2026-10-15',
    );
    expect(nbsp(missed?.text)).toBe(
      'Льготный период потерян: выписку 14 000 ₽ не внесли целиком к 14 октября.',
    );
    expect(missed?.warning).toBe(true);
    expect(cardStatus({ kind: 'none' })).toBeNull();
  });

  it('shows the limit and what is left of it', () => {
    expect(nbsp(limitStatus(platinum, 78_000 * RUB))).toBe('Лимит 106 000 ₽, свободно 28 000 ₽');
    expect(nbsp(limitStatus(platinum, 110_000 * RUB))).toBe('Лимит 106 000 ₽ превышен на 4 000 ₽');
    expect(limitStatus({ creditLimitMinor: undefined }, 0)).toBeNull();
  });
});
