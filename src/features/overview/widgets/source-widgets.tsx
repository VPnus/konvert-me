import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Plus, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listFeedItems, listFeeds, refreshEnabledFeeds } from '@/db/repositories/feeds';
import { createLink, deleteLink, listLinks } from '@/db/repositories/links';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettings } from '@/hooks/use-settings';
import { currentLocale, strings } from '@/i18n';
import { WidgetEmpty, WidgetFrame } from '@/features/overview/widgets/widget-shell';
import type { WidgetProps } from '@/features/overview/widgets/types';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Pinned sources: purely local, nothing is ever requested from the addresses. */
export function LinksWidget(_props: WidgetProps) {
  const dataVersion = useDataVersion();
  const links = useLiveQuery(() => listLinks(), [dataVersion], []);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createLink({ title, url });
      setTitle('');
      setUrl('');
      setAdding(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : strings.common.error);
    }
  };

  return (
    <WidgetFrame title={strings.widgets.links.title}>
      {links.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">{strings.widgets.links.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{link.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{hostOf(link.url)}</span>
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label={`${strings.widgets.links.remove}: ${link.title}`}
                onClick={() => void deleteLink(link.id)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
          <Input
            value={title}
            required
            aria-label={strings.widgets.links.name}
            placeholder={strings.widgets.links.namePlaceholder}
            data-testid="link-title"
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            value={url}
            required
            type="url"
            aria-label={strings.widgets.links.url}
            placeholder={strings.widgets.links.urlPlaceholder}
            data-testid="link-url"
            onChange={(event) => setUrl(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive" data-testid="link-error">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" data-testid="link-save">
              {strings.common.save}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              {strings.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => setAdding(true)}
          data-testid="link-add"
        >
          <Plus className="size-4" aria-hidden />
          {strings.widgets.links.add}
        </Button>
      )}
    </WidgetFrame>
  );
}

/** News: the only widget that goes to the network, and only with permission. */
export function NewsWidget(_props: WidgetProps) {
  const dataVersion = useDataVersion();
  const settings = useSettings();
  const feeds = useLiveQuery(() => listFeeds(), [dataVersion], []);
  const items = useLiveQuery(() => listFeedItems(12), [dataVersion], []);
  const [busy, setBusy] = useState(false);

  if (!settings.externalFeedsEnabled) {
    return (
      <WidgetFrame title={strings.widgets.news.title}>
        <WidgetEmpty
          text={strings.widgets.news.disabled}
          actionLabel={strings.widgets.news.disabledAction}
          to="/settings"
        />
      </WidgetFrame>
    );
  }

  if (feeds.length === 0) {
    return (
      <WidgetFrame title={strings.widgets.news.title}>
        <WidgetEmpty
          text={strings.widgets.news.noFeeds}
          actionLabel={strings.widgets.news.noFeedsAction}
          to="/settings"
        />
      </WidgetFrame>
    );
  }

  const lastFetchedAt = feeds.reduce<number | null>(
    (latest, feed) =>
      feed.lastFetchedAt && (!latest || feed.lastFetchedAt > latest) ? feed.lastFetchedAt : latest,
    null,
  );
  const failing = feeds.find((feed) => feed.lastError);

  const refresh = async () => {
    setBusy(true);
    try {
      await refreshEnabledFeeds();
    } finally {
      setBusy(false);
    }
  };

  return (
    <WidgetFrame
      title={strings.widgets.news.title}
      hint={
        lastFetchedAt
          ? `${strings.widgets.news.updated}: ${new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(lastFetchedAt)}`
          : strings.widgets.news.never
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.widgets.news.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="news-items">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="truncate text-sm hover:underline"
              >
                {item.title}
              </a>
              <span className="text-xs text-muted-foreground">
                {hostOf(item.url)}
                {item.publishedAt
                  ? ` · ${new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'short' }).format(item.publishedAt)}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {failing?.lastError ? (
        <p role="alert" className="text-xs text-destructive" data-testid="news-error">
          {failing.lastError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
          data-testid="news-refresh"
        >
          <RefreshCw className="size-4" aria-hidden />
          {busy ? strings.widgets.news.refreshing : strings.widgets.news.refresh}
        </Button>
        <Link to="/settings" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          {strings.widgets.news.openSource}
        </Link>
      </div>
    </WidgetFrame>
  );
}
