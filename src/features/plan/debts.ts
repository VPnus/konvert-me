/**
 * One queue of the debts for the whole plan, so the step of optimization and the list of actions never
 * disagree: a card whose statement is due comes first, by its date, for it costs nothing if paid in
 * full and a lot if not; then the debts that cost money, the dearest first; a card whose grace period
 * holds costs nothing and comes last. A repaid debt is not in the queue.
 */

import { graceHolds, type CardGrace } from '@/core/credit-card';
import type { Account } from '@/db/models';
import { holdsMoney } from '@/db/repositories/accounts';

export interface Benchmark {
  /** What the savings earn at best. */
  readonly rate: number;
  /** The account that earns it; null when the rate comes from the settings. */
  readonly accountName: string | null;
}

/**
 * The best rate among the accounts with money on them, or the return of the settings when no account
 * has a rate: a debt dearer than what the savings really earn is the one to repay.
 */
export function savingsBenchmark(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, number>,
  defaultReturnRate: number,
): Benchmark {
  const best = accounts
    .filter((account) => !account.archived && holdsMoney(account) && account.rate !== undefined)
    .filter((account) => (balances.get(account.id) ?? account.openingBalanceMinor) > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
  return best?.rate !== undefined
    ? { rate: best.rate, accountName: best.name }
    : { rate: defaultReturnRate, accountName: null };
}

export interface DebtInQueue {
  readonly account: Account;
  readonly balanceMinor: number;
  readonly grace: CardGrace;
  /** The statement of a card to pay in full by its date. */
  readonly statement: Extract<CardGrace, { kind: 'due' }> | null;
  /** The grace period holds: the debt costs nothing today. */
  readonly free: boolean;
  /** Costs more than the savings earn: cheaper to repay early. */
  readonly dear: boolean;
}

export interface DebtQueueParams {
  readonly accounts: readonly Account[];
  readonly balances: ReadonlyMap<string, number>;
  readonly cards: ReadonlyMap<string, CardGrace>;
  readonly benchmark: Benchmark;
}

export function debtQueue({ accounts, balances, cards, benchmark }: DebtQueueParams): DebtInQueue[] {
  const queue = accounts
    .filter((account) => account.side === 'liability' && !account.archived)
    .map((account) => {
      const grace = cards.get(account.id) ?? { kind: 'none' as const };
      const free = graceHolds(account, grace);
      return {
        account,
        balanceMinor: balances.get(account.id) ?? account.openingBalanceMinor,
        grace,
        statement: grace.kind === 'due' ? grace : null,
        free,
        dear: !free && account.rate !== undefined && account.rate > benchmark.rate,
      };
    })
    .filter((debt) => debt.balanceMinor > 0);

  const rank = (debt: DebtInQueue) => (debt.statement ? 0 : debt.free ? 2 : 1);
  return queue.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.statement && b.statement ? a.statement.dueDate.localeCompare(b.statement.dueDate) : 0) ||
      (b.account.rate ?? -1) - (a.account.rate ?? -1) ||
      a.account.name.localeCompare(b.account.name, 'ru'),
  );
}
