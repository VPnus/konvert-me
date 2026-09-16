import { FileText, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import {
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  type DocumentCategory,
  type TaxDocument,
} from '@/db/models';
import { addDocument, deleteDocument, documentBlob } from '@/db/repositories/documents';
import { ru } from '@/i18n/ru';
import { downloadBlob } from '@/lib/download';
import { formatBytes } from '@/lib/persist';

const t = ru.deductions;

interface DocumentsCardProps {
  readonly year: number;
  readonly documents: readonly TaxDocument[];
  readonly totalSizeBytes: number;
}

/** The papers of one year: brought in, opened, thrown away. They never leave the device. */
export function DocumentsCard({ year, documents, totalSizeBytes }: DocumentsCardProps) {
  const [category, setCategory] = useState<DocumentCategory>('income');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaxDocument | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const bring = async (file: File) => {
    setError(null);
    // Refused before it is read: a film of the flat should not be pulled into memory first.
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(t.docTooLarge.replace('{limit}', formatBytes(MAX_DOCUMENT_BYTES)));
      return;
    }

    setBusy(true);
    try {
      await addDocument({
        year,
        category,
        fileName: file.name,
        mimeType: file.type,
        content: await file.arrayBuffer(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const open = async (paper: TaxDocument) => {
    setError(null);
    try {
      downloadBlob(await documentBlob(paper), paper.fileName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  return (
    <Card data-testid="documents-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">{t.docsTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{t.docsHint}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-3">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="docs-empty">
            {t.docsEmpty}
          </p>
        ) : (
          <ul>
            {documents.map((paper) => (
              <li
                key={paper.id}
                className="flex items-center gap-2 border-b border-border py-2 last:border-b-0"
                data-testid="doc-row"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-sm hover:underline"
                  aria-label={t.docOpen.replace('{name}', paper.fileName)}
                  data-testid={`doc-open-${paper.id}`}
                  onClick={() => void open(paper)}
                >
                  <span className="block truncate">{paper.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.docCategories[paper.category]} · {formatBytes(paper.sizeBytes)}
                  </span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={t.docRemove.replace('{name}', paper.fileName)}
                  data-testid={`doc-delete-${paper.id}`}
                  onClick={() => setPendingDelete(paper)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <Field label={t.docCategory}>
            {(id) => (
              <Select
                id={id}
                value={category}
                data-testid="doc-category"
                onChange={(event) => setCategory(event.target.value as DocumentCategory)}
              >
                {DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t.docCategories[item]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label={t.docFile} hint={t.docFileHint.replace('{limit}', formatBytes(MAX_DOCUMENT_BYTES))}>
            {(id) => (
              <input
                id={id}
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                disabled={busy}
                data-testid="doc-file"
                className="w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void bring(file);
                }}
              />
            )}
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="doc-error">
            {error}
          </p>
        ) : null}

        {totalSizeBytes > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="docs-size">
            {t.docsSize.replace('{size}', formatBytes(totalSizeBytes))}
          </p>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.docDeleteConfirmTitle}
        description={t.docDeleteConfirmText}
        confirmLabel={ru.common.delete}
        destructive
        onConfirm={() => {
          if (pendingDelete) void deleteDocument(pendingDelete.id);
          setPendingDelete(null);
        }}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      />
    </Card>
  );
}
