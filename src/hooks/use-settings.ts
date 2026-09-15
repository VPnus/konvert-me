import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/db/db';
import { DEFAULT_SETTINGS, type AppSettings } from '@/db/models';
import { useDataVersion } from '@/hooks/use-data-version';

/**
 * The settings row. A liveQuery may only read, so a missing row falls back to the
 * defaults of the plan; the row itself is created by the first write.
 */
export function useSettings(): AppSettings {
  const dataVersion = useDataVersion();
  const settings = useLiveQuery(() => db.settings.get('app'), [dataVersion]);

  return settings ?? DEFAULT_SETTINGS;
}
