import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/db/db';
import {
  buildDefaultLayout,
  DASHBOARD_ID,
  DEFAULT_WIDGETS,
  ensureDashboardLayout,
  getDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  widgetWidth,
  widgetHeight,
  resizeWidget,
} from '@/db/repositories/dashboard';
import { WIDGET_REGISTRY } from '@/features/overview/widgets/registry';

beforeEach(async () => {
  await db.dashboardLayouts.clear();
});

describe('dashboard layout', () => {
  it('builds a default layout of known widgets', () => {
    const layout = buildDefaultLayout();
    const knownTypes = new Set(WIDGET_REGISTRY.map((widget) => widget.type));

    expect(layout.items).toHaveLength(DEFAULT_WIDGETS.length);
    expect(layout.items.every((item) => knownTypes.has(item.widgetType))).toBe(true);
    expect(layout.items.map((item) => item.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(layout.items.map((item) => item.instanceId)).size).toBe(layout.items.length);
  });

  it('creates the default layout on the first read and keeps it afterwards', async () => {
    const created = await ensureDashboardLayout();
    expect(created.id).toBe(DASHBOARD_ID);

    const again = await ensureDashboardLayout();
    expect(again.items.map((item) => item.instanceId)).toEqual(created.items.map((item) => item.instanceId));
    expect(await db.dashboardLayouts.count()).toBe(1);
  });

  it('renumbers the order when the widgets are moved', async () => {
    const layout = await ensureDashboardLayout();
    const reordered = {
      ...layout,
      items: [
        { ...layout.items[2], order: 0 },
        { ...layout.items[0], order: 1 },
        { ...layout.items[1], order: 2 },
        ...layout.items.slice(3),
      ],
    };

    const saved = await saveDashboardLayout(reordered);

    expect(saved.items[0].widgetType).toBe(layout.items[2].widgetType);
    expect(saved.items.map((item) => item.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('survives a resize and a removal', async () => {
    const layout = await ensureDashboardLayout();
    await saveDashboardLayout({
      ...layout,
      items: layout.items.filter((_, index) => index !== 0).map((item) => ({ ...item, size: 'S' as const })),
    });

    const stored = await getDashboardLayout();
    expect(stored?.items).toHaveLength(layout.items.length - 1);
    expect(stored?.items.every((item) => item.size === 'S')).toBe(true);
  });

  it('comes back to the standard set on reset', async () => {
    const layout = await ensureDashboardLayout();
    await saveDashboardLayout({ ...layout, items: [] });
    expect((await getDashboardLayout())?.items).toHaveLength(0);

    const reset = await resetDashboardLayout();
    expect(reset.items).toHaveLength(DEFAULT_WIDGETS.length);
  });
});

describe('dashboard: the size of a widget', () => {
  const item = { instanceId: 'w1', widgetType: 'net-worth', size: 'S' as const, order: 0, settings: {} };

  it('reads the width of a layout written before free resizing', () => {
    expect(widgetWidth({ size: 'S' })).toBe(1);
    expect(widgetWidth({ size: 'M' })).toBe(2);
    expect(widgetWidth({ size: 'L' })).toBe(4);
    expect(widgetHeight({})).toBe(1);
  });

  it('prefers the width the user set over the old three-step size', () => {
    expect(widgetWidth({ size: 'S', width: 3 })).toBe(3);
    expect(widgetHeight({ height: 2 })).toBe(2);
  });

  it('keeps the old size in step with the width, so both agree', () => {
    const [resized] = resizeWidget([item], 'w1', 3, 2);

    expect(resized.width).toBe(3);
    expect(resized.height).toBe(2);
    // one column is S, the full width is L, everything between is M
    expect(resized.size).toBe('M');
    expect(resizeWidget([item], 'w1', 4, 1)[0].size).toBe('L');
    expect(resizeWidget([item], 'w1', 1, 1)[0].size).toBe('S');
  });

  it('never lets a widget out of the grid', () => {
    expect(resizeWidget([item], 'w1', 99, 99)[0]).toMatchObject({ width: 4, height: 3 });
    expect(resizeWidget([item], 'w1', -5, 0)[0]).toMatchObject({ width: 1, height: 1 });
  });

  it('leaves every other widget alone', () => {
    const other = { ...item, instanceId: 'w2' };
    const items = resizeWidget([item, other], 'w1', 4, 1);

    expect(items[1]).toBe(other);
  });
});
