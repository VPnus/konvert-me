import type { Transaction } from '@/db/models';

/** What the operations list is filtered by. Empty strings mean "everything". */
export interface TransactionFilterState {
  readonly query: string;
  readonly kind: '' | Transaction['kind'];
  readonly categoryId: string;
  readonly accountId: string;
}

export const EMPTY_FILTER: TransactionFilterState = {
  query: '',
  kind: '',
  categoryId: '',
  accountId: '',
};

export function isFilterEmpty(filter: TransactionFilterState): boolean {
  return !filter.query && !filter.kind && !filter.categoryId && !filter.accountId;
}
