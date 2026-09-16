import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { updateSettings } from '@/db/repositories/settings';
import { useDataVersion } from '@/hooks/use-data-version';
import { useSettingsState } from '@/hooks/use-settings';
import { ru } from '@/i18n/ru';
import { dataRisk, type DataRisk } from '@/lib/data-risk';
import { formatBytes, getStorageStatus, type StorageStatus } from '@/lib/persist';
import { detectPlatform, looksPrivate } from '@/lib/platform';

const t = ru.settings.dataRisk;

function textOf(risk: DataRisk): string {
  switch (risk.kind) {
    case 'private':
      return t.private;
    case 'space':
      return t.space
        .replace('{usage}', formatBytes(risk.usageBytes))
        .replace('{quota}', formatBytes(risk.quotaBytes));
    case 'safari':
      return t.safari;
    case 'not-persisted':
      return t.notPersisted;
  }
}

/**
 * The ways the browser itself could lose the data, one at a time and the most serious first.
 * The storage is asked again after every change, since new papers are what fill it.
 */
export function DataRiskBanner() {
  const dataVersion = useDataVersion();
  const { settings, loading } = useSettingsState();
  // Read together with the moment it was read, so the render itself stays free of the clock.
  const [storage, setStorage] = useState<{ status: StorageStatus; at: number } | null>(null);
  const [privateMode, setPrivateMode] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getStorageStatus().then((status) => {
      if (active) setStorage({ status, at: Date.now() });
    });
    return () => {
      active = false;
    };
  }, [dataVersion]);

  useEffect(() => {
    let active = true;
    void looksPrivate().then((value) => {
      if (active) setPrivateMode(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading || storage === null || privateMode === null) return null;

  const risk = dataRisk({
    privateMode,
    platform: detectPlatform(),
    storage: storage.status,
    dismissed: settings.dataRiskDismissed ?? null,
    now: storage.at,
  });
  if (!risk) return null;

  return (
    <div
      role="status"
      data-testid="data-risk"
      data-kind={risk.kind}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1 basis-64">{textOf(risk)}</span>
      <div className="flex gap-2">
        <Link to="/settings" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          {t.action}
        </Link>
        <Button
          size="sm"
          variant="ghost"
          data-testid="data-risk-dismiss"
          onClick={() => void updateSettings({ dataRiskDismissed: { kind: risk.kind, at: Date.now() } })}
        >
          {t.dismiss}
        </Button>
      </div>
    </div>
  );
}
