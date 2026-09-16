import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  summarizeDeductionYear,
  type HomeSale,
  type PropertyClaim,
  type PropertyUsedBefore,
} from '@/core/deductions';
import { RULES_2025 } from '@/core/rules/2025';
import type { IsoDate } from '@/core/time';
import { RefundCard } from '@/features/deductions/refund-card';

const RUB = 100;

afterEach(cleanup);

/** The year 2025 with a salary of 1,2 million and a home sold in it, as seen on a given day. */
function showSale(sale: HomeSale, today: IsoDate, purchaseMinor = 0) {
  const summary = summarizeDeductionYear(
    {
      incomeMinor: 1_200_000 * RUB,
      social: { commonMinor: 0, childEducationMinor: [], expensiveTreatmentMinor: 0 },
      longTermSavingsMinor: 0,
      property: purchaseMinor
        ? {
            purchaseMinor,
            mortgageInterestMinor: 0,
            loanBefore2014: false,
            usedBeforePurchaseMinor: 0,
            usedBeforeInterestMinor: 0,
          }
        : undefined,
      sale,
    },
    RULES_2025,
  );

  render(
    <RefundCard
      view={{ year: 2025, stage: 'open', rules: RULES_2025, saved: undefined, summary, documents: [] }}
      summary={summary}
      childrenAtWork={false}
      usedBefore={undefined}
      today={today}
    />,
  );
}

// the tax service example: sold for 3 million, bought for 2,5 million — 65 000 to pay
const kotov: HomeSale = {
  priceMinor: 3_000_000 * RUB,
  cadastralMinor: 0,
  expensesMinor: 2_500_000 * RUB,
  ownedLongEnough: false,
};

describe('what is left of a home', () => {
  /** The year 2025 with a home bought and its interest, as the answers give them. */
  function showHome(incomeMinor: number, property: PropertyClaim & PropertyUsedBefore) {
    const summary = summarizeDeductionYear(
      {
        incomeMinor,
        social: { commonMinor: 0, childEducationMinor: [], expensiveTreatmentMinor: 0 },
        longTermSavingsMinor: 0,
        property,
      },
      RULES_2025,
    );

    render(
      <RefundCard
        view={{ year: 2025, stage: 'open', rules: RULES_2025, saved: undefined, summary, documents: [] }}
        summary={summary}
        childrenAtWork={false}
        usedBefore={property}
        today="2026-09-16"
      />,
    );
  }

  it('names the rest of the home itself and of the interest apart, as the return asks for them', () => {
    // 1,2 million of the home was taken before; the salary of 2025 takes the other 800 000 and 100 000 of interest
    showHome(900_000 * RUB, {
      purchaseMinor: 3_000_000 * RUB,
      mortgageInterestMinor: 400_000 * RUB,
      loanBefore2014: false,
      usedBeforePurchaseMinor: 1_200_000 * RUB,
      usedBeforeInterestMinor: 0,
    });

    const left = screen.getByTestId('refund-property-left');
    expect(left.textContent).toMatch(/следующие годы: 300\s000\s₽ за проценты\./);
    expect(left.textContent).toMatch(
      /за 2026 год укажите, что уже получено: 2\s000\s000\s₽ за стоимость жилья и 100\s000\s₽ за проценты\./,
    );
  });

  it('leaves out a part with nothing in it', () => {
    showHome(600_000 * RUB, {
      purchaseMinor: 2_000_000 * RUB,
      mortgageInterestMinor: 0,
      loanBefore2014: false,
      usedBeforePurchaseMinor: 0,
      usedBeforeInterestMinor: 0,
    });

    const left = screen.getByTestId('refund-property-left');
    expect(left.textContent).toMatch(/следующие годы: 1\s400\s000\s₽ за стоимость жилья\./);
    expect(left.textContent).toMatch(/уже получено: 600\s000\s₽ за стоимость жилья\.$/);
  });

  it('does not say what to state next year when nothing was taken yet', () => {
    showHome(0, {
      purchaseMinor: 2_000_000 * RUB,
      mortgageInterestMinor: 0,
      loanBefore2014: false,
      usedBeforePurchaseMinor: 0,
      usedBeforeInterestMinor: 0,
    });

    expect(screen.queryByTestId('refund-property-left')).toBeNull();
  });
});

describe('the deadlines of a home sold', () => {
  it('names both days while they are ahead', () => {
    showSale(kotov, '2026-03-01');

    expect(screen.getByTestId('refund-title')).toHaveTextContent('Нужно доплатить');
    expect(screen.getByTestId('refund-sale-deadline')).toHaveTextContent(
      'декларацию за 2025 год нужно подать до 30 апреля 2026 года, а налог заплатить до 15 июля 2026 года',
    );
  });

  it('says the return is late once 30 April is gone, and the tax is still ahead', () => {
    showSale(kotov, '2026-05-01');

    const note = screen.getByTestId('refund-sale-deadline');
    expect(note).toHaveTextContent('нужно было подать до 30 апреля 2026 года');
    expect(note).toHaveTextContent('заплатить до 15 июля 2026 года');
  });

  it('counts 30 April itself as still in time', () => {
    showSale(kotov, '2026-04-30');

    expect(screen.getByTestId('refund-sale-deadline')).toHaveTextContent('нужно подать до 30 апреля');
  });

  it('says both are late once 15 July is gone', () => {
    showSale(kotov, '2026-09-16');

    expect(screen.getByTestId('refund-sale-deadline')).toHaveTextContent('пени');
  });

  it('still asks for the return when a home bought leaves no tax, and says when that is late', () => {
    showSale(kotov, '2026-09-16', 2_000_000 * RUB);

    expect(screen.getByTestId('refund-title')).toHaveTextContent('Можно вернуть');
    expect(screen.getByTestId('refund-sale-deadline')).toHaveTextContent(
      'нужно было подать до 30 апреля 2026 года, даже если налога не осталось',
    );
  });

  it('asks for nothing when the home was owned long enough', () => {
    showSale({ ...kotov, ownedLongEnough: true }, '2026-03-01');

    expect(screen.queryByTestId('refund-sale-deadline')).toBeNull();
    expect(screen.getByTestId('refund-sale-notes')).toHaveTextContent('налога с продажи нет');
  });
});
