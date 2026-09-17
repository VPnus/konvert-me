import { useLiveQuery } from 'dexie-react-hooks';
import { Outlet } from 'react-router-dom';

import { StorageBootstrap } from '@/components/common/storage-bootstrap';
import { DEFAULT_COUNTRY } from '@/core/country';
import { getCountry } from '@/db/repositories/settings';
import { useDataVersion } from '@/hooks/use-data-version';
import { useRecordAppOpen } from '@/hooks/use-usage';
import { setCurrentCountry } from '@/i18n/country';

/**
 * The app itself, the onboarding included, as opposed to the pages of the site: only here a day of
 * use is counted and the browser is asked to keep the storage. A visitor of the landing is not
 * asked for anything.
 *
 * The screens wait for the country of the data: it gives the currency of every sum, the norms and
 * the tabs. Another country, chosen here or in another tab or brought by a backup, draws every
 * screen anew.
 */
export function AppSession() {
  useRecordAppOpen();
  const dataVersion = useDataVersion();
  // Settings that cannot be read leave the default: the screen that reads the data then shows the
  // error inside its own boundary, instead of a blank page.
  const country = useLiveQuery(() => getCountry().catch(() => DEFAULT_COUNTRY), [dataVersion]);
  if (country !== undefined) setCurrentCountry(country);

  return (
    <>
      <StorageBootstrap />
      {country === undefined ? null : <Outlet key={country} />}
    </>
  );
}
