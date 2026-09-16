import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '@/db/models';
import { PensionCard } from '@/features/plan/pension-card';

describe('plan: the pension card', () => {
  it('opens when the average expenses are not whole kopecks', () => {
    // 17 054 744 kopecks over three months, the worker of the scenario audit: the card used to
    // fall over with "ожидались целые копейки" and took the whole step down with it.
    render(
      <PensionCard
        pension={null}
        savedMinor={0}
        settings={DEFAULT_SETTINGS}
        averageExpensesMinor={17_054_744 / 3}
      />,
    );

    expect(screen.getByTestId('pension-expenses')).toHaveValue('56849');
  });
});
