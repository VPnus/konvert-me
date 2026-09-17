import { describe, expect, it } from 'vitest';

import type { Account } from '@/db/models';
import {
  cardTransferWarning,
  statementOfDay,
  type CardTransferContext,
} from '@/features/budget/card-transfer';

const RUB = 100;
const plain = (lines: string[]) => lines.map((line) => line.replace(/\s/g, ' '));

const account = (patch: Partial<Account>): Account => ({
  id: 'a',
  name: 'Счёт',
  side: 'liability',
  type: 'credit_card',
  currency: 'RUB',
  openingBalanceMinor: 0,
  openingDate: '2026-08-20',
  isLiquid: false,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const platinum = account({
  id: 'platinum',
  name: 'Кредитка Платинум',
  rate: 0.499,
  statementDay: 19,
  paymentDay: 14,
  freeTransfersMinor: 50_000 * RUB,
});
const oldCard = account({ id: 'old', name: 'Кредитная карта', rate: 0.299 });

describe('a transfer from a credit card', () => {
  it('falls into the next statement, or into the one made that very day', () => {
    expect(statementOfDay('2026-09-20', platinum)).toEqual({ statement: '2026-10-19', due: '2026-11-14' });
    expect(statementOfDay('2026-09-19', platinum)).toEqual({ statement: '2026-09-19', due: '2026-10-14' });
    expect(statementOfDay('2026-09-20', oldCard)).toBeNull();
  });

  it('says when the money comes back, that a usual month has none for it, and what the old debt becomes', () => {
    const context: CardTransferContext = {
      card: platinum,
      debtMinor: 14_000 * RUB,
      availableMinor: -8_163 * RUB,
      transfersInMonthMinor: 0,
    };
    expect(plain(cardTransferWarning(context, 50_000 * RUB, oldCard, '2026-09-20'))).toEqual([
      'Перевод попадёт в выписку 19 октября, и всю выписку нужно внести до 14 ноября: к этому дню понадобится около 64 000 ₽.',
      'А свободных денег после платежей по долгам в обычный месяц нет.',
      'Не вернёте вовремя, и долг под 29,9 % станет долгом под 49,9 %.',
    ]);
  });

  it('names what a usual month leaves, and the transfers beyond the free ones', () => {
    const context: CardTransferContext = {
      card: platinum,
      debtMinor: 0,
      availableMinor: 12_000 * RUB,
      transfersInMonthMinor: 30_000 * RUB,
    };
    expect(
      plain(
        cardTransferWarning(context, 25_000 * RUB, account({ side: 'asset', type: 'debit' }), '2026-09-20'),
      ),
    ).toEqual([
      'Перевод попадёт в выписку 19 октября, и всю выписку нужно внести до 14 ноября: к этому дню понадобится около 25 000 ₽.',
      'В обычный месяц после платежей по долгам у вас остаётся 12 000 ₽.',
      'В этом месяце без комиссии можно перевести ещё 20 000 ₽. Сверх этого банк обычно берёт комиссию и не даёт льготного периода.',
    ]);
    expect(
      plain(cardTransferWarning({ ...context, card: oldCard }, 1_000 * RUB, undefined, '2026-09-20'))[0],
    ).toBe('Карта даёт деньги в долг: чтобы не платить проценты, их нужно вернуть к сроку из договора.');
  });
});
