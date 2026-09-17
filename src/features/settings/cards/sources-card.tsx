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
  refreshFeed,
  setFeedEnabled,
  updateFeed,
  type FeedInput,
} from '@/db/repositories/feeds';
import { updateSettings } from '@/db/repositories/settings';
import { FeedForm } from '@/features/settings/cards/feed-form';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettings } from '@/hooks/use-settings';
import { currentLocale, strings } from '@/i18n';
import { maskSecret, maskUrl } from '@/lib/secrets';

function authLabel(feed: Feed): string {
  const auth = feed.auth ?? { kind: 'none' };
  if (auth.kind === 'none') return strings.sources.keyNone;
  if (auth.kind === 'query')
    return `${strings.sources.keyStored} · ${auth.paramName}=${maskSecret(auth.key)}`;
  if (auth.kind === 'header')
    return `${strings.sources.keyStored} · ${auth.headerName}: ${maskSecret(auth.key)}`;
  return `${strings.sources.keyStored} · Bearer ${maskSecret(auth.key)}`;
}

function formatMoment(timestamp: number | null): string {
  if (timestamp === null) return strings.widgets.news.never;
  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(
    timestamp,
  );
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
  const [checked, setChecked] = useState<{ ok: boolean; text: string } | null>(null);

  /**
   * A saved feed is read once straight away: otherwise the user is left staring at a
   * form that looks fine while the widget quietly shows nothing.
   */
  const checkFeed = async (feed: Feed) => {
    if (!externalEnabled) {
      setChecked({ ok: false, text: strings.sources.checkOffline });
      return;
    }

    setChecked({ ok: true, text: strings.sources.checking });
    try {
      const count = await refreshFeed(feed);
      setChecked({ ok: true, text: strings.sources.checkOk.replace('{count}', String(count)) });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : strings.common.error;
      setChecked({ ok: false, text: `${strings.sources.checkFailed} ${reason}` });
    }
  };

  const addFeed = async (input: FeedInput) => {
    await checkFeed(await createFeed(input));
  };

  const saveFeed = async (id: string, input: FeedInput) => {
    const feed = await updateFeed(id, input);
    setEditingId(null);
    await checkFeed(feed);
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
        <CardTitle>{strings.sources.title}</CardTitle>
        <CardDescription>{strings.sources.text}</CardDescription>
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
          {strings.sources.enable}
        </label>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium">{strings.sources.feedsTitle}</p>

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
                        {strings.widgets.news.updated}: {formatMoment(feed.lastFetchedAt)}
                      </p>
                      {feed.lastError ? (
                        <p className="mt-1 text-xs text-destructive" data-testid="feed-last-error">
                          {strings.sources.feedError}: {feed.lastError}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={feed.enabled}
                          className="size-4 accent-[var(--color-primary)]"
                          aria-label={feed.enabled ? strings.sources.feedOn : strings.sources.feedOff}
                          onChange={(event) => void setFeedEnabled(feed.id, event.target.checked)}
                        />
                        {feed.enabled ? strings.sources.feedOn : strings.sources.feedOff}
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`${strings.sources.feedEdit}: ${feed.title}`}
                        data-testid={`feed-edit-${feed.title}`}
                        onClick={() => setEditingId(editingId === feed.id ? null : feed.id)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`${strings.sources.feedRemove}: ${feed.title}`}
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

          {checked ? (
            <p
              role="status"
              className={`text-xs ${checked.ok ? 'text-muted-foreground' : 'text-destructive'}`}
              data-testid="feed-check"
            >
              {checked.text}
            </p>
          ) : null}

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
            {strings.sources.refreshAll}
          </Button>

          <p className="text-xs text-muted-foreground">{strings.sources.corsNote}</p>
          <p className="text-xs text-muted-foreground">{strings.sources.apiNote}</p>
        </div>
      </CardContent>
    </Card>
  );
}
