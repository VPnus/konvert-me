/**
 * Shared input types for the pure financial core.
 *
 * The core never imports React, Dexie or anything from src/db and src/features.
 * These types are deliberately narrower than the stored entities of docs/PLAN.md
 * section 4: the repository layer maps stored rows onto them.
 */

import type { IsoDate, IsoMonth } from './time';

export type TransactionKind = 'income' | 'expense' | 'refund' | 'transfer' | 'adjustment' | 'revaluation';

/** Which way a manual correction or a revaluation moves the balance of its account. */
export type BalanceDirection = 'increase' | 'decrease';

export interface CoreTransaction {
  readonly id?: string;
  readonly date: IsoDate;
  /** Always a positive amount in kopecks; the kind and the direction carry the sign. */
  readonly amountMinor: number;
  readonly kind: TransactionKind;
  readonly accountId: string;
  readonly toAccountId?: string;
  readonly categoryId?: string;
  readonly direction?: BalanceDirection;
}

export type CategoryKind = 'income' | 'expense';
export type CategoryGroup = 'mandatory' | 'variable';

export interface CoreCategory {
  readonly id: string;
  readonly kind: CategoryKind;
  readonly group?: CategoryGroup;
}

export type AccountSide = 'asset' | 'liability';

export interface CoreAccount {
  readonly id: string;
  readonly side: AccountSide;
  readonly isLiquid: boolean;
  readonly openingBalanceMinor: number;
  readonly openingDate: IsoDate;
  readonly archived?: boolean;
  /** Scheduled monthly payment of a debt, used by the debt burden of formula 10. */
  readonly monthlyPaymentMinor?: number;
}

export interface CoreBudgetPlanLine {
  readonly month: IsoMonth;
  readonly categoryId: string;
  readonly amountMinor: number;
}

export interface CoreEnvelope {
  readonly goalId: string;
  readonly accountId: string;
  readonly amountMinor: number;
}
