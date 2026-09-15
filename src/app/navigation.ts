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
  /** Shown in the bottom bar on a narrow screen; the rest hide behind "Ещё". */
  readonly primary: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/overview', label: ru.nav.overview, icon: LayoutDashboard, primary: true },
  { to: '/budget', label: ru.nav.budget, icon: Wallet, primary: true },
  { to: '/goals', label: ru.nav.goals, icon: Target, primary: true },
  { to: '/balance', label: ru.nav.balance, icon: Landmark, primary: true },
  { to: '/deductions', label: ru.nav.deductions, icon: ReceiptText, primary: false },
  { to: '/plan', label: ru.nav.plan, icon: ClipboardList, primary: false },
  { to: '/settings', label: ru.nav.settings, icon: Settings, primary: false },
];

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.primary);
