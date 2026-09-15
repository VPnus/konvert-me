import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/db/db';
import { DEFAULT_SETTINGS, type AppSettings } from '@/db/models';
import { useDataVersion } from '@/hooks/use-data-version';

export interface SettingsState {
  readonly settings: AppSettings;
  /** True until the first read finishes: undefined means "not read yet", null means "no row". */
  readonly loading: boolean;
}

/**
 * A liveQuery may only read, so a missing row falls back to the defaults of the plan;
 * the row itself is created by the first write.
 */
export function useSettingsState(): SettingsState {
  const dataVersion = useDataVersion();
  const row = useLiveQuery(async () => (await db.settings.get('app')) ?? null, [dataVersion]);

  return { settings: row ?? DEFAULT_SETTINGS, loading: row === undefined };
}

export function useSettings(): AppSettings {
  return useSettingsState().settings;
}
