import { describe, expect, it } from 'vitest';

import type { CardGrace } from '@/core/credit-card';
import {
  cardReminder,
  reminderText,
  withDismissed,
  type CardOfReminder,
} from '@/features/balance/card-reminder';

const RUB = 100;
const plain = (text: string) => text.replace(/\s/g, ' ');

const due: CardGrace = {
  kind: 'due',
  statementDate: '2026-09-19',
  dueDate: '2026-10-14',
  statementMinor: 14_000 * RUB,
  paidMinor: 0,
  remainingMinor: 14_000 * RUB,
  minimumMinor: 1_120 * RUB,
};
const platinum: CardOfReminder = { account: { id: 'p', name: 'Кредитка Платинум', rate: 0.499 }, grace: due };

describe('the reminder of a credit card', () => {
  it('comes a week before the due day and once more the day before, not earlier', () => {
    expect(cardReminder('2026-10-06', [platinum], [])).toBeNull();

    const week = cardReminder('2026-10-07', [platinum], []);
    expect(week).toMatchObject({ kind: 'week', key: 'week:p:2026-10-14', inDays: 7 });
    expect(plain(reminderText(week!, '2026-10-07'))).toBe(
      'До 14 октября внесите на «Кредитка Платинум» всю выписку: 14 000 ₽. Тогда банк не начислит проценты, а минимальный платёж 1 120 ₽ льготный период не сохраняет.',
    );

    // hidden for the week, it comes back the day before
    expect(cardReminder('2026-10-10', [platinum], [week!.key])).toBeNull();
    const day = cardReminder('2026-10-13', [platinum], [week!.key]);
    expect(day).toMatchObject({ kind: 'day', key: 'day:p:2026-10-14' });
    expect(plain(reminderText(day!, '2026-10-13'))).toBe(
      'Завтра последний день: внесите на «Кредитка Платинум» 14 000 ₽, иначе банк начислит проценты по ставке 49,9 % с даты покупок.',
    );
    expect(plain(reminderText(cardReminder('2026-10-14', [platinum], [])!, '2026-10-14'))).toMatch(
      /^Сегодня/,
    );
  });

  it('warns after the due day, before anything else, with the interest of a month', () => {
    const missed: CardOfReminder = {
      account: { id: 'p', name: 'Кредитка Платинум', rate: 0.499 },
      grace: {
        kind: 'missed',
        statementDate: '2026-09-19',
        dueDate: '2026-10-14',
        statementMinor: 14_000 * RUB,
        paidMinor: 5_680 * RUB,
        debtMinor: 72_320 * RUB,
        monthlyInterestMinor: 300_731,
      },
    };
    const other: CardOfReminder = { account: { id: 'o', name: 'Другая', rate: undefined }, grace: due };

    const reminder = cardReminder('2026-10-13', [other, missed], []);
    expect(reminder).toMatchObject({ kind: 'missed', key: 'missed:p:2026-10-14' });
    expect(plain(reminderText(reminder!, '2026-10-15'))).toBe(
      'Срок внести выписку по «Кредитка Платинум» прошёл 14 октября: записано 5 680 ₽ из 14 000 ₽. Если внесли всё, запишите платёж. Если нет, банк начисляет проценты по ставке 49,9 % с даты покупок: около 3 007 ₽ в месяц, пока долг не погашен целиком.',
    );
    expect(cardReminder('2026-10-13', [other, missed], [reminder!.key])?.account.id).toBe('o');
  });

  it('reminds of one long grace period by its date, and after it ends', () => {
    const long: CardOfReminder = {
      account: { id: 'l', name: 'Карта 120 дней', rate: undefined },
      grace: { kind: 'grace-ends', date: '2026-12-01', debtMinor: 30_000 * RUB },
    };
    expect(cardReminder('2026-11-20', [long], [])).toBeNull();
    const week = cardReminder('2026-11-24', [long], []);
    expect(plain(reminderText(week!, '2026-11-24'))).toBe(
      'До 1 декабря погасите «Карта 120 дней» целиком: 30 000 ₽. После этой даты банк начнёт начислять проценты.',
    );
    expect(cardReminder('2026-11-30', [long], [week!.key])?.kind).toBe('grace-day');

    const ended = cardReminder(
      '2026-12-02',
      [
        {
          ...long,
          grace: {
            kind: 'grace-ended',
            date: '2026-12-01',
            debtMinor: 30_000 * RUB,
            monthlyInterestMinor: null,
          },
        },
      ],
      [],
    );
    expect(plain(reminderText(ended!, '2026-12-02'))).toBe(
      'Льготный период по «Карта 120 дней» закончился 1 декабря, а долг 30 000 ₽ не погашен. Банк начисляет проценты. Если условия карты новые, поправьте их в карточке счёта.',
    );
  });

  it('remembers the hidden reminders without growing for ever', () => {
    const many = Array.from({ length: 60 }, (_, index) => `week:p:${index}`);
    const kept = withDismissed(many, 'day:p:2026-10-14');
    expect(kept).toHaveLength(50);
    expect(kept.at(-1)).toBe('day:p:2026-10-14');
    expect(withDismissed(['a', 'b'], 'a')).toEqual(['b', 'a']);
  });
});
