import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Feed } from '@/db/models';
import {
  createFeed,
  deleteFeed,
  listFeeds,
  refreshEnabledFeeds,
  setFeedEnabled,
  updateFeed,
  type FeedInput,
} from '@/db/repositories/feeds';
import { updateSettings } from '@/db/repositories/settings';
import { FeedForm } from '@/features/settings/cards/feed-form';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettings } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';
import { maskSecret, maskUrl } from '@/lib/secrets';

function authLabel(feed: Feed): string {
  const auth = feed.auth ?? { kind: 'none' };
  if (auth.kind === 'none') return ru.sources.keyNone;
  if (auth.kind === 'query') return `${ru.sources.keyStored} · ${auth.paramName}=${maskSecret(auth.key)}`;
  if (auth.kind === 'header') return `${ru.sources.keyStored} · ${auth.headerName}: ${maskSecret(auth.key)}`;
  return `${ru.sources.keyStored} · Bearer ${maskSecret(auth.key)}`;
}

function formatMoment(timestamp: number | null): string {
  if (timestamp === null) return ru.widgets.news.never;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp);
}

/**
 * The single switch that lets the app talk to the outside world, and the feeds it may
 * read. Off by default; the text says plainly what turning it on means.
 */
export function SourcesCard() {
  const settings = useSettings();
  const dataVersion = useDataVersion();
  const feeds = useLiveQuery(() => listFeeds(), [dataVersion], []);

  // The switch answers the click at once and yields to the stored value once it catches up.
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const externalEnabled = pendingEnabled ?? settings.externalFeedsEnabled;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFeed = async (input: FeedInput) => {
    await createFeed(input);
  };

  const saveFeed = async (id: string, input: FeedInput) => {
    await updateFeed(id, input);
    setEditingId(null);
  };

  const refresh = async () => {
    setBusy(true);
    try {
      await refreshEnabledFeeds();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ru.sources.title}</CardTitle>
        <CardDescription>{ru.sources.text}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={externalEnabled}
            className="size-4 accent-[var(--color-primary)]"
            data-testid="external-sources-toggle"
            onChange={(event) => {
              const next = event.target.checked;
              setPendingEnabled(next);
              void updateSettings({ externalFeedsEnabled: next }).catch(() => setPendingEnabled(null));
            }}
          />
          {ru.sources.enable}
        </label>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium">{ru.sources.feedsTitle}</p>

          {feeds.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {feeds.map((feed) => (
                <li key={feed.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{feed.title}</p>
                      <p className="truncate text-xs text-muted-foreground" data-testid="feed-url-shown">
                        {maskUrl(feed.url)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" data-testid="feed-auth">
                        {authLabel(feed)}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="feed-updated">
                        {ru.widgets.news.updated}: {formatMoment(feed.lastFetchedAt)}
                      </p>
                      {feed.lastError ? (
                        <p className="mt-1 text-xs text-destructive" data-testid="feed-last-error">
                          {ru.sources.feedError}: {feed.lastError}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={feed.enabled}
                          className="size-4 accent-[var(--color-primary)]"
                          aria-label={feed.enabled ? ru.sources.feedOn : ru.sources.feedOff}
                          onChange={(event) => void setFeedEnabled(feed.id, event.target.checked)}
                        />
                        {feed.enabled ? ru.sources.feedOn : ru.sources.feedOff}
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`${ru.sources.feedEdit}: ${feed.title}`}
                        data-testid={`feed-edit-${feed.title}`}
                        onClick={() => setEditingId(editingId === feed.id ? null : feed.id)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`${ru.sources.feedRemove}: ${feed.title}`}
                        onClick={() => void deleteFeed(feed.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {editingId === feed.id ? (
                    <div className="border-t border-border pt-3">
                      <FeedForm
                        feed={feed}
                        onSubmit={(input) => saveFeed(feed.id, input)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <FeedForm onSubmit={addFeed} />

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={!externalEnabled || feeds.length === 0 || busy}
            onClick={() => void refresh()}
            data-testid="feed-refresh"
          >
            <RefreshCw className="size-4" aria-hidden />
            {ru.sources.refreshAll}
          </Button>

          <p className="text-xs text-muted-foreground">{ru.sources.corsNote}</p>
          <p className="text-xs text-muted-foreground">{ru.sources.apiNote}</p>
        </div>
      </CardContent>
    </Card>
  );
}
