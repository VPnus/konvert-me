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

import { ru } from '@/i18n/ru';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** All seven tabs, in the order they stand in the bar above the page. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/overview', label: ru.nav.overview, icon: LayoutDashboard },
  { to: '/budget', label: ru.nav.budget, icon: Wallet },
  { to: '/goals', label: ru.nav.goals, icon: Target },
  { to: '/balance', label: ru.nav.balance, icon: Landmark },
  { to: '/deductions', label: ru.nav.deductions, icon: ReceiptText },
  { to: '/plan', label: ru.nav.plan, icon: ClipboardList },
  { to: '/settings', label: ru.nav.settings, icon: Settings },
];
