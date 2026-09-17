import { Outlet } from 'react-router-dom';

import { StorageBootstrap } from '@/components/common/storage-bootstrap';
import { useRecordAppOpen } from '@/hooks/use-usage';

/**
 * The app itself, the onboarding included, as opposed to the pages of the site: only here a day of
 * use is counted and the browser is asked to keep the storage. A visitor of the landing is not
 * asked for anything.
 */
export function AppSession() {
  useRecordAppOpen();

  return (
    <>
      <StorageBootstrap />
      <Outlet />
    </>
  );
}
