import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutGrid, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettingsState } from '@/hooks/use-settings';
import { DashboardGrid, type SizeUpdate } from '@/features/overview/dashboard-grid';
import { WidgetCatalog } from '@/features/overview/widget-catalog';
import { loadOverview } from '@/features/overview/overview-data';
import { findWidget } from '@/features/overview/widgets/registry';
import {
  buildDefaultLayout,
  getDashboardLayout,
  resetDashboardLayout,
  resizeWidget,
  saveDashboardLayout,
  widgetHeight,
  widgetWidth,
  type WidgetInstance,
} from '@/db/repositories/dashboard';
import { ru } from '@/i18n/ru';

export default function OverviewPage() {
  const dataVersion = useDataVersion();
  const { settings, loading: settingsLoading } = useSettingsState();
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const data = useLiveQuery(() => loadOverview(), [dataVersion]);
  // A liveQuery may only read, so the missing layout is filled in by an effect.
  const storedLayout = useLiveQuery(async () => (await getDashboardLayout()) ?? null, [dataVersion]);
  const fallbackLayout = useMemo(() => buildDefaultLayout(), []);

  useEffect(() => {
    if (storedLayout === null) void resetDashboardLayout();
  }, [storedLayout]);

  const layout = storedLayout ?? (storedLayout === null ? fallbackLayout : undefined);

  // Never redirect on the very first render: the settings are not read yet then.
  if (settingsLoading) return <p className="text-sm text-muted-foreground">{ru.common.loading}</p>;
  if (!settings.onboardingDone) return <Navigate to="/welcome" replace />;
  if (!data || !layout) return <p className="text-sm text-muted-foreground">{ru.common.loading}</p>;

  const items = [...layout.items].sort((a, b) => a.order - b.order) as WidgetInstance[];

  /**
   * Every change to the layout goes through one queue. Two arrow presses in a row are
   * two writes to the same row: without the queue the second one reads the layout
   * before the first one has saved, and the first change is lost.
   */
  const enqueue = (work: () => Promise<unknown>): void => {
    writes.current = writes.current.then(work, work);
  };

  const persist = (next: WidgetInstance[]) => {
    enqueue(() => saveDashboardLayout({ ...layout, items: next }));
  };

  /** Resizing reads the layout back first, so a change builds on the saved size. */
  const resize = (instanceId: string, update: SizeUpdate) => {
    enqueue(async () => {
      const current = (await getDashboardLayout()) ?? layout;
      const item = current.items.find((widget) => widget.instanceId === instanceId);
      if (!item) return;

      const next = update({ width: widgetWidth(item), height: widgetHeight(item) });
      await saveDashboardLayout({
        ...current,
        items: resizeWidget(current.items as WidgetInstance[], instanceId, next.width, next.height),
      });
    });
  };

  const addWidget = (widgetType: string) => {
    const definition = findWidget(widgetType);
    if (!definition) return;

    persist([
      ...items,
      {
        instanceId: crypto.randomUUID(),
        widgetType,
        size: definition.defaultSize,
        order: items.length,
        settings: {},
      },
    ]);
    setCatalogOpen(false);
  };

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{ru.overview.title}</h1>
          <p className="text-sm text-muted-foreground">{ru.pages.overview.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCatalogOpen(true)}
                data-testid="add-widget"
              >
                <Plus className="size-4" aria-hidden />
                {ru.overview.addWidget}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetOpen(true)}
                data-testid="reset-dashboard"
              >
                <RotateCcw className="size-4" aria-hidden />
                {ru.overview.reset}
              </Button>
            </>
          ) : null}

          <Button
            size="sm"
            variant={editing ? 'default' : 'outline'}
            onClick={() => setEditing((current) => !current)}
            data-testid="customize-dashboard"
          >
            <LayoutGrid className="size-4" aria-hidden />
            {editing ? ru.overview.done : ru.overview.customize}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{ru.overview.empty}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void resetDashboardLayout()}>
            {ru.overview.reset}
          </Button>
        </div>
      ) : (
        <DashboardGrid
          items={items}
          data={data}
          editing={editing}
          onReorder={(next) => persist(next)}
          onResize={resize}
          onRemove={(instanceId) => persist(items.filter((item) => item.instanceId !== instanceId))}
        />
      )}

      <WidgetCatalog open={catalogOpen} items={items} onOpenChange={setCatalogOpen} onAdd={addWidget} />

      <ConfirmDialog
        open={resetOpen}
        title={ru.overview.resetConfirmTitle}
        description={ru.overview.resetConfirmText}
        confirmLabel={ru.overview.reset}
        onConfirm={() => {
          void resetDashboardLayout();
          setResetOpen(false);
        }}
        onOpenChange={setResetOpen}
      />
    </section>
  );
}
