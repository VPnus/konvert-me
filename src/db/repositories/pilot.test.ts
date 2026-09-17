import { beforeEach, describe, expect, it } from 'vitest';

import { clearAllData } from '@/db/backup';
import { createAccount } from '@/db/repositories/accounts';
import { setPlan } from '@/db/repositories/budget-plans';
import { seedDefaultCategories } from '@/db/repositories/categories';
import { saveDeductionYear } from '@/db/repositories/deductions';
import { saveEducationPlan, savePensionPlan } from '@/db/repositories/financial-plan';
import { createGoal, ensureReserveGoal } from '@/db/repositories/goals';
import { countForPilot } from '@/db/repositories/pilot';
import { createTransaction, importTransactions } from '@/db/repositories/transactions';

const RUB = 100;

beforeEach(async () => {
  await clearAllData();
  await seedDefaultCategories();
});

describe('the counts of the pilot stats', () => {
  it('are all zero on an empty device, the reserve alone is no goal', async () => {
    await ensureReserveGoal();

    expect(await countForPilot()).toEqual({
      goals: 0,
      accounts: 0,
      operations: 0,
      importedOperations: 0,
      budgetMonths: 0,
      deductionYears: 0,
      planCalculations: 0,
    });
  });

  it('count each kind of data, and nothing of what is in it', async () => {
    await ensureReserveGoal();
    await createGoal({
      name: 'Квартира',
      kind: 'purchase',
      costMinor: 4_000_000 * RUB,
      costAsOf: '2026-09',
      targetMonth: '2029-09',
    });

    const card = await createAccount({ name: 'Карта', side: 'asset', type: 'debit', openingBalanceMinor: 0 });
    await createAccount({ name: 'Кредит', side: 'liability', type: 'consumer', openingBalanceMinor: 0 });

    await createTransaction({
      date: '2026-09-10',
      amountMinor: 1_000 * RUB,
      kind: 'expense',
      accountId: card.id,
      categoryId: 'groceries',
    });
    await importTransactions([
      {
        date: '2026-09-11',
        amountMinor: 65_000 * RUB,
        kind: 'income',
        accountId: card.id,
        categoryId: 'salary',
        importRowHash: 'row-1',
      },
      {
        date: '2026-09-12',
        amountMinor: 500 * RUB,
        kind: 'expense',
        accountId: card.id,
        categoryId: 'groceries',
        importRowHash: 'row-2',
      },
    ]);

    await setPlan('2026-08', 'salary', 65_000 * RUB);
    await setPlan('2026-09', 'salary', 65_000 * RUB);
    await setPlan('2026-09', 'groceries', 20_000 * RUB);

    await saveDeductionYear({
      year: 2025,
      incomeMinor: 780_000 * RUB,
      spending: {
        treatmentMinor: 0,
        educationMinor: 0,
        sportMinor: 0,
        insuranceMinor: 0,
        childEducationMinor: [],
        expensiveTreatmentMinor: 0,
      },
      longTermSavingsMinor: 0,
      status: 'draft',
    });

    await saveEducationPlan(
      {
        name: 'Маша',
        yearlyCostMinor: 600_000 * RUB,
        years: 6,
        costAsOf: '2026-09',
        startMonth: '2034-09',
        returnRate: 0.0883,
        inflationRate: 0.069,
      },
      '2026-09-17',
    );
    await savePensionPlan(
      {
        birthMonth: '1986-03',
        retirementAge: 60,
        lifeAge: 80,
        monthlyExpensesMinor: 116_149 * RUB,
        replacementRate: 0.7,
        statePensionMinor: 26_000 * RUB,
        costAsOf: '2026-09',
        returnRate: 0.0873,
        inflationRate: 0.069,
        strategy: 'spend-capital',
      },
      '2026-09-17',
    );

    expect(await countForPilot()).toEqual({
      goals: 1,
      accounts: 2,
      operations: 3,
      importedOperations: 2,
      budgetMonths: 2,
      deductionYears: 1,
      planCalculations: 2,
    });
  });
});
