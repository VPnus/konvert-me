/**
 * Pinned sources: a title and an address the user keeps at hand. Nothing is ever
 * requested from them — the widget only shows the list.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { linkSchema, type Link } from '@/db/models';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';

export interface LinkInput {
  title: string;
  url: string;
  note?: string;
}

export async function listLinks(): Promise<Link[]> {
  const links = await db.links.toArray();
  return links.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export async function createLink(input: LinkInput): Promise<Link> {
  const count = await db.links.count();
  const link = parseOrThrow(
    linkSchema,
    { ...input, id: crypto.randomUUID(), sortOrder: count, createdAt: Date.now() },
    'Источник',
  );

  await db.links.add(link);
  publishAppEvent({ type: 'data-changed' });
  return link;
}

export async function updateLink(id: string, patch: Partial<LinkInput>): Promise<Link> {
  const current = await db.links.get(id);
  if (!current) throw new RepositoryError('Источник не найден');

  const next = parseOrThrow(linkSchema, { ...current, ...patch, id: current.id }, 'Источник');
  await db.links.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteLink(id: string): Promise<void> {
  await db.links.delete(id);
  publishAppEvent({ type: 'data-changed' });
}

export async function reorderLinks(orderedIds: readonly string[]): Promise<void> {
  await db.transaction('rw', db.links, async () => {
    let sortOrder = 0;
    for (const id of orderedIds) {
      const link = await db.links.get(id);
      if (!link) continue;
      await db.links.put({ ...link, sortOrder });
      sortOrder += 1;
    }
  });
  publishAppEvent({ type: 'data-changed' });
}
