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

import { strings } from '@/i18n';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** All seven tabs, in the order they stand in the bar above the page. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/overview', label: strings.nav.overview, icon: LayoutDashboard },
  { to: '/budget', label: strings.nav.budget, icon: Wallet },
  { to: '/goals', label: strings.nav.goals, icon: Target },
  { to: '/balance', label: strings.nav.balance, icon: Landmark },
  { to: '/deductions', label: strings.nav.deductions, icon: ReceiptText },
  { to: '/plan', label: strings.nav.plan, icon: ClipboardList },
  { to: '/settings', label: strings.nav.settings, icon: Settings },
];
