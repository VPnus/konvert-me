import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  createFeed,
  deleteFeed,
  listFeeds,
  refreshEnabledFeeds,
  setFeedEnabled,
} from '@/db/repositories/feeds';
import { updateSettings } from '@/db/repositories/settings';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettings } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';

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

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFeed = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createFeed({ title, url });
      setTitle('');
      setUrl('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
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
                <li
                  key={feed.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{feed.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{feed.url}</p>
                    <p className="text-xs text-muted-foreground" data-testid="feed-updated">
                      {ru.widgets.news.updated}:{' '}
                      {feed.lastFetchedAt
                        ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(
                            feed.lastFetchedAt,
                          )
                        : ru.widgets.news.never}
                    </p>
                    {feed.lastError ? (
                      <p className="mt-1 text-xs text-destructive">
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
                      aria-label={`${ru.sources.feedRemove}: ${feed.title}`}
                      onClick={() => void deleteFeed(feed.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <form className="flex flex-col gap-3" onSubmit={(event) => void addFeed(event)}>
            <Field label={ru.sources.feedName}>
              {(id) => (
                <Input
                  id={id}
                  value={title}
                  required
                  data-testid="feed-title"
                  onChange={(event) => setTitle(event.target.value)}
                />
              )}
            </Field>

            <Field label={ru.sources.feedUrl} hint={ru.sources.feedUrlHint}>
              {(id) => (
                <Input
                  id={id}
                  value={url}
                  required
                  type="url"
                  placeholder="https://hnrss.org/frontpage"
                  data-testid="feed-url"
                  onChange={(event) => setUrl(event.target.value)}
                />
              )}
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-destructive" data-testid="feed-error">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" data-testid="feed-add">
                {ru.sources.feedAdd}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!externalEnabled || feeds.length === 0 || busy}
                onClick={() => void refresh()}
                data-testid="feed-refresh"
              >
                <RefreshCw className="size-4" aria-hidden />
                {ru.sources.refreshAll}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground">{ru.sources.corsNote}</p>
        </div>
      </CardContent>
    </Card>
  );
}
