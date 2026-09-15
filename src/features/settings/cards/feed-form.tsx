import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Feed, FeedAuth } from '@/db/models';
import type { FeedInput } from '@/db/repositories/feeds';
import { ru } from '@/i18n/ru';
import { FEED_PRESETS, findFeedPreset, type FeedPreset } from '@/lib/feed-presets';

interface FeedFormProps {
  readonly feed?: Feed;
  readonly onSubmit: (input: FeedInput) => Promise<void>;
  readonly onCancel?: () => void;
}

type AuthKind = FeedAuth['kind'];

/** One form for both adding a source and changing its key. */
export function FeedForm({ feed, onSubmit, onCancel }: FeedFormProps) {
  const existingAuth = feed?.auth ?? { kind: 'none' as const };

  const [title, setTitle] = useState(feed?.title ?? '');
  const [url, setUrl] = useState(feed?.url ?? '');
  const [authKind, setAuthKind] = useState<AuthKind>(existingAuth.kind);
  const [key, setKey] = useState('');
  const [paramName, setParamName] = useState(
    existingAuth.kind === 'query' ? existingAuth.paramName : 'apiKey',
  );
  const [headerName, setHeaderName] = useState(
    existingAuth.kind === 'header' ? existingAuth.headerName : 'X-Api-Key',
  );
  const [itemsPath, setItemsPath] = useState(feed?.itemsPath ?? '');
  const [advanced, setAdvanced] = useState(Boolean(feed?.itemsPath));
  const [presetId, setPresetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preset = presetId ? findFeedPreset(presetId) : undefined;
  const presetText = (item: FeedPreset) => ru.sources.presets[item.id as keyof typeof ru.sources.presets];

  /** Picking a ready-made source fills in everything except the key itself. */
  const applyPreset = (chosen: FeedPreset | undefined, id: string) => {
    setPresetId(id);
    if (!chosen) return;
    setTitle(presetText(chosen).name);
    setUrl(chosen.url);
    setAuthKind(chosen.auth);
    if (chosen.paramName) setParamName(chosen.paramName);
    if (chosen.headerName) setHeaderName(chosen.headerName);
    setItemsPath(chosen.itemsPath ?? '');
    if (chosen.itemsPath) setAdvanced(true);
  };

  /** When editing, an empty key field means "keep the key that is already stored". */
  const keptKey = existingAuth.kind === 'none' ? '' : existingAuth.key;
  const effectiveKey = key || keptKey;

  const buildAuth = (): FeedAuth => {
    if (authKind === 'none') return { kind: 'none' };
    if (authKind === 'query') return { kind: 'query', paramName, key: effectiveKey };
    if (authKind === 'header') return { kind: 'header', headerName, key: effectiveKey };
    return { kind: 'bearer', key: effectiveKey };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await onSubmit({ title, url, auth: buildAuth(), itemsPath: itemsPath.trim() || undefined });
      if (!feed) {
        setTitle('');
        setUrl('');
        setKey('');
        setAuthKind('none');
        setItemsPath('');
        setPresetId('');
      } else {
        setKey('');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ru.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      {feed ? null : (
        <Field label={ru.sources.presetLabel} hint={preset ? undefined : ru.sources.presetHint}>
          {(id) => (
            <Select
              id={id}
              value={presetId}
              data-testid="feed-preset"
              onChange={(event) => applyPreset(findFeedPreset(event.target.value), event.target.value)}
            >
              <option value="">{ru.sources.presetNone}</option>
              {FEED_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {presetText(item).label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {preset ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground" data-testid="feed-preset-note">
            {presetText(preset).note}
          </p>
          {preset.browserBlocked ? (
            <p className="text-xs text-warning" data-testid="feed-preset-blocked">
              {ru.sources.presetBlocked}
            </p>
          ) : null}
          {preset.keyUrl ? (
            <a
              href={preset.keyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="w-fit text-xs underline underline-offset-2"
            >
              {ru.sources.presetKeyLink}
            </a>
          ) : null}
        </div>
      ) : null}

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

      <Field label={ru.sources.authTitle}>
        {(id) => (
          <Select
            id={id}
            value={authKind}
            data-testid="feed-auth-kind"
            onChange={(event) => setAuthKind(event.target.value as AuthKind)}
          >
            <option value="none">{ru.sources.authNone}</option>
            <option value="query">{ru.sources.authQuery}</option>
            <option value="header">{ru.sources.authHeader}</option>
            <option value="bearer">{ru.sources.authBearer}</option>
          </Select>
        )}
      </Field>

      {authKind === 'query' ? (
        <Field label={ru.sources.authParamName}>
          {(id) => (
            <Input
              id={id}
              value={paramName}
              required
              data-testid="feed-param-name"
              onChange={(event) => setParamName(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      {authKind === 'header' ? (
        <Field label={ru.sources.authHeaderName}>
          {(id) => (
            <Input
              id={id}
              value={headerName}
              required
              data-testid="feed-header-name"
              onChange={(event) => setHeaderName(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      {authKind !== 'none' ? (
        <Field label={ru.sources.authKey} hint={keptKey ? ru.sources.authKeyKeep : ru.sources.authKeyHint}>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={key}
              required={!keptKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={keptKey ? '••••••••' : ''}
              data-testid="feed-key"
              onChange={(event) => setKey(event.target.value)}
            />
          )}
        </Field>
      ) : null}

      {advanced ? (
        <Field label={ru.sources.itemsPath} hint={ru.sources.itemsPathHint}>
          {(id) => (
            <Input
              id={id}
              value={itemsPath}
              placeholder="data.articles"
              data-testid="feed-items-path"
              onChange={(event) => setItemsPath(event.target.value)}
            />
          )}
        </Field>
      ) : (
        <button
          type="button"
          className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setAdvanced(true)}
        >
          {ru.sources.advanced}
        </button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="feed-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy} data-testid={feed ? 'feed-save' : 'feed-add'}>
          {feed ? ru.sources.feedSave : ru.sources.feedAdd}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            {ru.sources.feedCancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
