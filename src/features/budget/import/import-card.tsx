import { useLiveQuery } from 'dexie-react-hooks';
import { Upload, Trash2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorBoundary } from '@/components/common/error-boundary';
import type { Account, Category } from '@/db/models';
import { deleteImportBatch, listImportBatches, type ImportBatch } from '@/db/repositories/transactions';
import { useDataVersion } from '@/hooks/use-data-version';
import { ru } from '@/i18n/ru';

// PapaParse and ExcelJS live in this chunk: nothing of them is fetched until a
// statement is actually imported.
const ImportWizard = lazy(() => import('@/features/budget/import/import-wizard'));

interface ImportCardProps {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
}

/** The way in for a statement, and the way back out of one. */
export function ImportCard({ accounts, categories }: ImportCardProps) {
  const dataVersion = useDataVersion();
  const [open, setOpen] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<ImportBatch | null>(null);

  const batches = useLiveQuery(() => listImportBatches(), [dataVersion], []);

  return (
    <Card data-testid="import-card">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{ru.import.batchesTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{ru.import.batchesHint}</p>
        </div>
        <Button
          size="sm"
          disabled={accounts.length === 0}
          data-testid="import-open"
          onClick={() => setOpen(true)}
        >
          <Upload className="size-4" aria-hidden />
          {ru.import.open}
        </Button>
      </CardHeader>

      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="import-batches-empty">
            {ru.import.batchesEmpty}
          </p>
        ) : (
          <ul>
            {batches.map((batch) => (
              <li
                key={batch.batchId}
                className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                data-testid="import-batch-row"
              >
                <span className="min-w-0 truncate text-sm">
                  {ru.import.batchRow
                    .replace('{count}', String(batch.count))
                    .replace('{from}', batch.from)
                    .replace('{to}', batch.to)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={ru.import.undo}
                  data-testid={`import-undo-${batch.batchId}`}
                  onClick={() => setPendingUndo(batch)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {open ? (
        <ErrorBoundary fallback={() => <p className="p-4 text-sm text-destructive">{ru.common.error}</p>}>
          <Suspense fallback={null}>
            <ImportWizard accounts={accounts} categories={categories} onOpenChange={setOpen} />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      <ConfirmDialog
        open={pendingUndo !== null}
        title={ru.import.undoConfirmTitle}
        description={ru.import.undoConfirmText}
        confirmLabel={ru.import.undo}
        destructive
        onConfirm={() => {
          if (pendingUndo) void deleteImportBatch(pendingUndo.batchId);
          setPendingUndo(null);
        }}
        onOpenChange={(next) => {
          if (!next) setPendingUndo(null);
        }}
      />
    </Card>
  );
}
