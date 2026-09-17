import { Outlet } from 'react-router-dom';

import { StorageBootstrap } from '@/components/common/storage-bootstrap';
import { useRecordAppOpen } from '@/hooks/use-usage';
import { useSettingsState } from '@/hooks/use-settings';
import { setCurrentCountry } from '@/i18n/country';

/**
 * The app itself, the onboarding included, as opposed to the pages of the site: only here a day of
 * use is counted and the browser is asked to keep the storage. A visitor of the landing is not
 * asked for anything.
 *
 * The screens wait for the settings: the country of the data gives the currency of every sum, the
 * norms and the tabs. Another country, chosen here or in another tab or brought by a backup, draws
 * every screen anew.
 */
export function AppSession() {
  useRecordAppOpen();
  const { settings, loading } = useSettingsState();
  if (!loading) setCurrentCountry(settings.country);

  return (
    <>
      <StorageBootstrap />
      {loading ? null : <Outlet key={settings.country} />}
    </>
  );
}
