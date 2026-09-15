import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ru } from '@/i18n/ru';
import { WIDGET_REGISTRY } from '@/features/overview/widgets/registry';
import type { WidgetInstance } from '@/db/repositories/dashboard';

interface CatalogProps {
  readonly open: boolean;
  readonly items: WidgetInstance[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onAdd: (widgetType: string) => void;
}

export function WidgetCatalog({ open, items, onOpenChange, onAdd }: CatalogProps) {
  const used = new Set(items.map((item) => item.widgetType));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">{ru.overview.catalogTitle}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {ru.overview.catalogText}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label={ru.nav.close} className="rounded-md p-1 hover:bg-accent">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {WIDGET_REGISTRY.map((widget) => {
              const alreadyUsed = used.has(widget.type) && !widget.repeatable;

              return (
                <li
                  key={widget.type}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{widget.title}</p>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={alreadyUsed}
                    data-testid={`catalog-add-${widget.type}`}
                    onClick={() => onAdd(widget.type)}
                  >
                    <Plus className="size-4" aria-hidden />
                    {alreadyUsed ? ru.overview.added : ru.common.add}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
