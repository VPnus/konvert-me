/**
 * The layout of the "Обзор" dashboard: an ordered list of widgets, each with a width
 * in columns and a height in rows. Widgets flow in that order — a free grid with
 * coordinates is deliberately out of scope (section 8.3 of the plan).
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
  /** Columns on a wide screen; missing in layouts written before free resizing. */
  width?: number;
  height?: number;
  order: number;
  settings: Record<string, unknown>;
}

export const MAX_WIDGET_WIDTH = 4;
export const MAX_WIDGET_HEIGHT = 3;

const WIDTH_BY_SIZE: Record<WidgetSize, number> = { S: 1, M: 2, L: 4 };

export function widgetWidth(item: Pick<WidgetInstance, 'size' | 'width'>): number {
  return item.width ?? WIDTH_BY_SIZE[item.size];
}

export function widgetHeight(item: Pick<WidgetInstance, 'height'>): number {
  return item.height ?? 1;
}

/** The old three-step size that matches a width, so both stay in agreement. */
export function sizeForWidth(width: number): WidgetSize {
  if (width <= 1) return 'S';
  return width >= 4 ? 'L' : 'M';
}

export function clampWidth(width: number): number {
  return Math.min(Math.max(Math.round(width), 1), MAX_WIDGET_WIDTH);
}

export function clampHeight(height: number): number {
  return Math.min(Math.max(Math.round(height), 1), MAX_WIDGET_HEIGHT);
}

/** Gives one widget a new size, leaving the rest of the layout alone. */
export function resizeWidget(
  items: readonly WidgetInstance[],
  instanceId: string,
  width: number,
  height: number,
): WidgetInstance[] {
  return items.map((item) => {
    if (item.instanceId !== instanceId) return item;
    const next = { width: clampWidth(width), height: clampHeight(height) };
    return { ...item, ...next, size: sizeForWidth(next.width) };
  });
}

/** The layout a user sees right after the onboarding: never an empty screen. */
export const DEFAULT_WIDGETS: readonly Omit<WidgetInstance, 'instanceId' | 'order'>[] = [
  { widgetType: 'free-cash', size: 'M', settings: {} },
  { widgetType: 'reserve', size: 'M', settings: {} },
  { widgetType: 'goals', size: 'L', settings: {} },
  { widgetType: 'net-worth', size: 'S', settings: {} },
  { widgetType: 'debt-burden', size: 'S', settings: {} },
  // the dates of payments and grace periods, where the reminder of a card is kept
  { widgetType: 'upcoming', size: 'M', settings: {} },
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
