/**
 * The papers behind a deduction: receipts, contracts, income statements. The description
 * and the bytes are kept apart, and the bytes are read only when a file is opened.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { documentFileSchema, documentSchema, type DocumentCategory, type TaxDocument } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { fill, strings } from '@/i18n';
import { publishAppEvent } from '@/lib/broadcast';

export interface DocumentInput {
  year: number;
  category: DocumentCategory;
  fileName: string;
  /** The type the browser reported; it may be empty for a file it does not recognise. */
  mimeType: string;
  content: ArrayBuffer;
  note?: string;
}

export async function addDocument(input: DocumentInput): Promise<TaxDocument> {
  const { content, ...described } = input;
  const document = parseOrThrow(
    documentSchema,
    {
      ...described,
      id: crypto.randomUUID(),
      mimeType: input.mimeType.trim() || 'application/octet-stream',
      // The size is what the bytes are, not what anyone said they were.
      sizeBytes: content.byteLength,
      createdAt: Date.now(),
    },
    strings.data.subjects.document,
  );
  const file = parseOrThrow(documentFileSchema, { id: document.id, content }, strings.data.subjects.document);

  await db.transaction('rw', db.documents, db.documentFiles, async () => {
    await db.documents.add(document);
    await db.documentFiles.add(file);
  });
  publishAppEvent({ type: 'data-changed' });
  return document;
}

/** Descriptions only, oldest first — in the order they were brought in. */
export async function listDocuments(year?: number): Promise<TaxDocument[]> {
  const rows =
    year === undefined
      ? await db.documents.toArray()
      : await db.documents.where('year').equals(year).toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function readDocumentContent(id: string): Promise<ArrayBuffer | undefined> {
  return (await db.documentFiles.get(id))?.content;
}

/**
 * The document as a file to show or to save. Missing bytes are said out loud: an empty
 * file handed over in silence would hide the loss until the day the paper is needed.
 */
export async function documentBlob(document: TaxDocument): Promise<Blob> {
  const content = await readDocumentContent(document.id);
  if (!content)
    throw new RepositoryError(fill(strings.data.notFound.documentFile, { name: document.fileName }));
  return new Blob([content], { type: document.mimeType });
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', db.documents, db.documentFiles, async () => {
    await db.documentFiles.delete(id);
    await db.documents.delete(id);
  });
  publishAppEvent({ type: 'data-changed' });
}

/** How much room the papers take — counted from their descriptions, without reading them. */
export async function documentsSizeBytes(): Promise<number> {
  return (await db.documents.toArray()).reduce((total, document) => total + document.sizeBytes, 0);
}
