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
