import { useEffect } from 'react';

import { getSettings, updateSettings } from '@/db/repositories/settings';
import { requestPersistentStorage } from '@/lib/persist';

/**
 * Asks for persistent storage on the first run and remembers the answer. Browsers
 * grant it silently to an installed or frequently used app, so nothing is shown.
 */
export function StorageBootstrap() {
  useEffect(() => {
    let active = true;

    void (async () => {
      const settings = await getSettings();
      if (settings.storagePersisted) return;

      const granted = await requestPersistentStorage();
      if (active && granted) await updateSettings({ storagePersisted: true });
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
