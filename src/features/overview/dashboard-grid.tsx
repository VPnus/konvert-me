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
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { strings } from '@/i18n';
import { cn } from '@/lib/utils';
import { findWidget } from '@/features/overview/widgets/registry';
import type { OverviewData } from '@/features/overview/overview-data';
import {
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_WIDTH,
  clampHeight,
  clampWidth,
  widgetHeight,
  widgetWidth,
  type WidgetInstance,
} from '@/db/repositories/dashboard';

/** One row of the grid; a widget one row tall is at least this high. */
const ROW_HEIGHT_REM = 11;

/**
 * The column span per width. A phone always shows one column and a tablet at most
 * two, whatever the widget asks for — the layout is free, the readable width is not.
 */
const WIDTH_CLASS: Record<number, string> = {
  1: 'sm:col-span-1 xl:col-span-1',
  2: 'sm:col-span-2 xl:col-span-2',
  3: 'sm:col-span-2 xl:col-span-3',
  4: 'sm:col-span-2 xl:col-span-4',
};

const HEIGHT_CLASS: Record<number, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
};

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * A resize is asked for as a change to whatever the widget is right now, not as a
 * fixed pair of numbers: two keystrokes in a row must not race the saved layout.
 */
export type SizeUpdate = (current: Size) => Size;

interface GridProps {
  readonly items: WidgetInstance[];
  readonly data: OverviewData;
  readonly editing: boolean;
  readonly onReorder: (items: WidgetInstance[]) => void;
  readonly onResize: (instanceId: string, update: SizeUpdate) => void;
  readonly onRemove: (instanceId: string) => void;
}

interface WidgetCellProps {
  readonly item: WidgetInstance;
  readonly data: OverviewData;
  readonly editing: boolean;
  readonly onResize: (instanceId: string, update: SizeUpdate) => void;
  readonly onRemove: (instanceId: string) => void;
}

function WidgetCell({ item, data, editing, onResize, onRemove }: WidgetCellProps) {
  const definition = findWidget(item.widgetType);
  const cellRef = useRef<HTMLDivElement | null>(null);
  // While the corner is dragged the widget shows the size it will get, not the one
  // it has: the layout is only written once the pointer is released.
  const [preview, setPreview] = useState<Size | null>(null);
  const previewRef = useRef<Size | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.instanceId,
    disabled: !editing,
  });

  const stored: Size = { width: widgetWidth(item), height: widgetHeight(item) };
  const size = preview ?? stored;
  const title = definition?.title ?? item.widgetType;

  const setRefs = (node: HTMLDivElement | null) => {
    cellRef.current = node;
    setNodeRef(node);
  };

  const showPreview = (next: Size | null) => {
    previewRef.current = next;
    setPreview(next);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const cell = cellRef.current;
    const grid = cell?.parentElement;
    if (!cell || !grid) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(' ').filter(Boolean).length;
    const gap = Number.parseFloat(style.columnGap) || 16;
    const step = (grid.getBoundingClientRect().width - gap * (columns - 1)) / columns + gap;
    const rowStep = ROW_HEIGHT_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

    const startX = event.clientX;
    const startY = event.clientY;

    const handleMove = (moveEvent: PointerEvent) => {
      // A narrower grid shows fewer columns than a widget keeps. The kept width changes only
      // when the one on screen does, so resizing on a phone leaves the wide layout alone.
      const shown = Math.min(stored.width, columns);
      const target = Math.min(clampWidth(shown + Math.round((moveEvent.clientX - startX) / step)), columns);
      const width = target === shown ? stored.width : target;
      const height = clampHeight(stored.height + Math.round((moveEvent.clientY - startY) / (rowStep + gap)));
      showPreview({ width, height });
    };

    // pointercancel: the browser took the gesture over (a call, a system swipe), nothing is saved.
    const handleEnd = (endEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);

      const next = previewRef.current;
      showPreview(null);
      if (
        endEvent.type === 'pointerup' &&
        next &&
        (next.width !== stored.width || next.height !== stored.height)
      ) {
        onResize(item.instanceId, () => next);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  /** The same resizing from the keyboard: the corner is a button, not just a grip. */
  const onHandleKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step: Record<string, Size> = {
      ArrowRight: { width: 1, height: 0 },
      ArrowLeft: { width: -1, height: 0 },
      ArrowDown: { width: 0, height: 1 },
      ArrowUp: { width: 0, height: -1 },
    };
    const delta = step[event.key];
    if (!delta) return;

    event.preventDefault();
    // Asked as a change, so holding an arrow down counts every press.
    onResize(item.instanceId, (current) => ({
      width: clampWidth(current.width + delta.width),
      height: clampHeight(current.height + delta.height),
    }));
  };

  return (
    <div
      ref={setRefs}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid={`widget-${item.widgetType}`}
      data-size={item.size}
      data-width={size.width}
      data-height={size.height}
      className={cn(
        'relative col-span-1 flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm',
        WIDTH_CLASS[size.width],
        HEIGHT_CLASS[size.height],
        isDragging && 'z-10 opacity-80 shadow-lg',
        preview && 'ring-2 ring-ring',
      )}
    >
      {editing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            // touch-none: otherwise a finger on a phone scrolls the page and the drag is cancelled
            className="flex cursor-grab touch-none items-center gap-1 rounded-md px-1 py-1 text-xs text-muted-foreground select-none hover:bg-accent active:cursor-grabbing pointer-coarse:py-2"
            aria-label={`${strings.overview.drag}: ${title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
            <span className="max-w-[10rem] truncate">{title}</span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {size.width} × {size.height}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={`${strings.overview.remove}: ${title}`}
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
            <p className="text-sm font-semibold">{strings.overview.widgetBroken}</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          </div>
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {definition ? (
            <definition.Component data={data} settings={item.settings} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">{strings.overview.widgetBroken}</div>
          )}
        </div>
      </ErrorBoundary>

      {editing ? (
        <button
          type="button"
          aria-label={`${strings.overview.resize}: ${title}`}
          title={strings.overview.resizeHint}
          data-testid={`resize-${item.widgetType}`}
          // Bigger under a finger; touch-none so that pulling it does not scroll the page.
          className="absolute right-0 bottom-0 flex size-6 cursor-se-resize touch-none items-center justify-center rounded-tl-md rounded-br-xl bg-accent text-muted-foreground select-none hover:text-foreground pointer-coarse:size-10"
          onPointerDown={startResize}
          onKeyDown={onHandleKey}
        >
          <svg viewBox="0 0 10 10" className="size-3 fill-current" aria-hidden>
            <path d="M9 1v8H1z" opacity="0.35" />
            <path d="M9 5v4H5z" />
          </svg>
        </button>
      ) : null}
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
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          style={{ gridAutoRows: `minmax(${ROW_HEIGHT_REM}rem, auto)` }}
          data-testid="dashboard-grid"
        >
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

export { MAX_WIDGET_HEIGHT, MAX_WIDGET_WIDTH };
