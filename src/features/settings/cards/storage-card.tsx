import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateSettings } from '@/db/repositories/settings';
import { fill, strings } from '@/i18n';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/lib/persist';

export function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    void getStorageStatus().then((value) => {
      if (active) setStatus(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const request = async () => {
    const granted = await requestPersistentStorage();
    setDenied(!granted);
    const next = await getStorageStatus();
    setStatus(next);
    await updateSettings({ storagePersisted: next.persisted });
  };

  const label = !status?.supported
    ? strings.settings.storageUnsupported
    : status.persisted
      ? strings.settings.storagePersisted
      : strings.settings.storageNotPersisted;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.settings.storageTitle}</CardTitle>
        <CardDescription>{strings.settings.storageText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm" data-testid="storage-status">
          <span
            className={`mr-2 inline-block size-2 rounded-full align-middle ${status?.persisted ? 'bg-success' : 'bg-warning'}`}
            aria-hidden
          />
          {label}
        </p>

        {status?.usageBytes !== undefined ? (
          <p className="text-sm text-muted-foreground">
            {strings.settings.storageUsage}:{' '}
            {status.quotaBytes
              ? fill(strings.settings.storageOfQuota, {
                  used: formatBytes(status.usageBytes),
                  quota: formatBytes(status.quotaBytes),
                })
              : formatBytes(status.usageBytes)}
          </p>
        ) : null}

        {status?.supported && !status.persisted ? (
          <div className="flex flex-col items-start gap-2">
            <Button size="sm" variant="outline" onClick={() => void request()}>
              {strings.settings.storageRequest}
            </Button>
            {denied ? (
              <p className="text-xs text-muted-foreground">{strings.settings.storageDenied}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
