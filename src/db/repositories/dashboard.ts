/**
 * The layout of the "Обзор" dashboard: an ordered list of widgets of size S, M or L.
 * A free grid with coordinates is deliberately out of scope (section 8.3 of the plan).
 */

import { db } from '@/db/db';
import { dashboardLayoutSchema, type DashboardLayout } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export const DASHBOARD_ID = 'default';

export type WidgetSize = 'S' | 'M' | 'L';

export interface WidgetInstance {
  instanceId: string;
  widgetType: string;
  size: WidgetSize;
  order: number;
  settings: Record<string, unknown>;
}

/** The layout a user sees right after the onboarding: never an empty screen. */
export const DEFAULT_WIDGETS: readonly Omit<WidgetInstance, 'instanceId' | 'order'>[] = [
  { widgetType: 'free-cash', size: 'M', settings: {} },
  { widgetType: 'reserve', size: 'M', settings: {} },
  { widgetType: 'goals', size: 'L', settings: {} },
  { widgetType: 'net-worth', size: 'S', settings: {} },
  { widgetType: 'debt-burden', size: 'S', settings: {} },
  { widgetType: 'warnings', size: 'M', settings: {} },
  { widgetType: 'quick-add', size: 'M', settings: {} },
];

export function buildDefaultLayout(): DashboardLayout {
  return {
    id: DASHBOARD_ID,
    name: 'Мой обзор',
    items: DEFAULT_WIDGETS.map((widget, index) => ({
      ...widget,
      instanceId: crypto.randomUUID(),
      order: index,
    })),
  };
}

export async function getDashboardLayout(): Promise<DashboardLayout | undefined> {
  return db.dashboardLayouts.get(DASHBOARD_ID);
}

export async function saveDashboardLayout(layout: DashboardLayout): Promise<DashboardLayout> {
  const normalized = {
    ...layout,
    id: DASHBOARD_ID,
    items: [...layout.items]
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index })),
  };

  const valid = parseOrThrow(dashboardLayoutSchema, normalized, 'Раскладка обзора');
  await db.dashboardLayouts.put(valid);
  publishAppEvent({ type: 'data-changed' });
  return valid;
}

export async function resetDashboardLayout(): Promise<DashboardLayout> {
  return saveDashboardLayout(buildDefaultLayout());
}

export async function ensureDashboardLayout(): Promise<DashboardLayout> {
  return (await getDashboardLayout()) ?? (await resetDashboardLayout());
}
