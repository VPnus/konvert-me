import {
  ClipboardList,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { Country } from '@/core/country';
import { DEDUCTION_COUNTRIES } from '@/features/deductions/country';
import { strings } from '@/i18n';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** A tab of some countries only; without it, a tab of every one. */
  readonly countries?: readonly Country[];
}

/** All seven tabs, in the order they stand in the bar above the page. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/overview', label: strings.nav.overview, icon: LayoutDashboard },
  { to: '/budget', label: strings.nav.budget, icon: Wallet },
  { to: '/goals', label: strings.nav.goals, icon: Target },
  { to: '/balance', label: strings.nav.balance, icon: Landmark },
  { to: '/deductions', label: strings.nav.deductions, icon: ReceiptText, countries: DEDUCTION_COUNTRIES },
  { to: '/plan', label: strings.nav.plan, icon: ClipboardList },
  { to: '/settings', label: strings.nav.settings, icon: Settings },
];

/** The tabs of the country of the data. */
export function navItemsFor(country: Country): NavItem[] {
  return NAV_ITEMS.filter((item) => item.countries?.includes(country) ?? true);
}
