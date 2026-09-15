import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { ru } from '@/i18n/ru';
import { cn } from '@/lib/utils';
import { findWidget } from '@/features/overview/widgets/registry';
import type { OverviewData } from '@/features/overview/overview-data';
import type { WidgetInstance, WidgetSize } from '@/db/repositories/dashboard';

const SIZE_CLASS: Record<WidgetSize, string> = {
  S: 'sm:col-span-1 xl:col-span-1',
  M: 'sm:col-span-2 xl:col-span-2',
  L: 'sm:col-span-2 xl:col-span-4',
};

interface GridProps {
  readonly items: WidgetInstance[];
  readonly data: OverviewData;
  readonly editing: boolean;
  readonly onReorder: (items: WidgetInstance[]) => void;
  readonly onResize: (instanceId: string, size: WidgetSize) => void;
  readonly onRemove: (instanceId: string) => void;
}

function WidgetCell({
  item,
  data,
  editing,
  onResize,
  onRemove,
}: {
  item: WidgetInstance;
  data: OverviewData;
  editing: boolean;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onRemove: (instanceId: string) => void;
}) {
  const definition = findWidget(item.widgetType);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.instanceId,
    disabled: !editing,
  });

  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`widget-${item.widgetType}`}
      data-size={item.size}
      className={cn(
        'col-span-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        SIZE_CLASS[item.size],
        isDragging && 'z-10 opacity-80 shadow-lg',
      )}
    >
      {editing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            className="flex cursor-grab items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground hover:bg-accent active:cursor-grabbing"
            aria-label={`${ru.overview.drag}: ${definition?.title ?? item.widgetType}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
            <span className="max-w-[10rem] truncate">{definition?.title ?? item.widgetType}</span>
          </button>

          <div className="flex items-center gap-1">
            {(definition?.sizes ?? (['S', 'M', 'L'] as const)).map((size) => (
              <Button
                key={size}
                size="sm"
                variant={item.size === size ? 'default' : 'outline'}
                className="h-7 w-8 px-0 text-xs"
                aria-label={`${ru.overview.size} ${size}`}
                aria-pressed={item.size === size}
                data-testid={`size-${item.widgetType}-${size}`}
                onClick={() => onResize(item.instanceId, size)}
              >
                {size}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={`${ru.overview.remove}: ${definition?.title ?? item.widgetType}`}
              data-testid={`remove-${item.widgetType}`}
              onClick={() => onRemove(item.instanceId)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <ErrorBoundary
        fallback={(error) => (
          <div className="p-4">
            <p className="text-sm font-semibold">{ru.overview.widgetBroken}</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          </div>
        )}
      >
        {definition ? (
          <definition.Component data={data} settings={item.settings} />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">{ru.overview.widgetBroken}</div>
        )}
      </ErrorBoundary>
    </div>
  );
}

export function DashboardGrid({ items, data, editing, onReorder, onResize, onRemove }: GridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.instanceId === active.id);
    const to = items.findIndex((item) => item.instanceId === over.id);
    if (from === -1 || to === -1) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next.map((item, index) => ({ ...item, order: index })));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.instanceId)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-grid">
          {items.map((item) => (
            <WidgetCell
              key={item.instanceId}
              item={item}
              data={data}
              editing={editing}
              onResize={onResize}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
