import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Notice } from '@/components/common/notice';
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

/** Hides a kind of warning from this moment: it comes back after a while, the risk has not gone. */
function hideRisk(kind: DataRisk['kind']): void {
  void updateSettings({ dataRiskDismissed: { kind, at: Date.now() } });
}

/**
 * The ways the browser itself could lose the data, one at a time and the most serious first.
 * The storage is asked again after every change, since new papers are what fill it —
 * the ones added in this very tab included.
 */
export function DataRiskBanner() {
  const dataVersion = useDataVersion({ includeThisTab: true });
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
    <Notice
      testId="data-risk"
      kind={risk.kind}
      icon={ShieldAlert}
      tone="warning"
      action={{ to: '/settings', label: t.action }}
      dismiss={{ label: t.dismiss, testId: 'data-risk-dismiss' }}
      onDismiss={() => hideRisk(risk.kind)}
    >
      {textOf(risk)}
    </Notice>
  );
}
