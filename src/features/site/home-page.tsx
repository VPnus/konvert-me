import { Navigate } from 'react-router-dom';

import LandingPage from '@/features/site/landing-page';
import { readUsage } from '@/lib/usage';

/**
 * The root address. Someone new meets the landing; someone who has opened the app on this device
 * goes straight into it. The check reads the days of use and not the database, so a visitor who
 * only looks around leaves nothing behind on the device.
 */
export default function HomePage() {
  if (readUsage() !== null) return <Navigate to="/overview" replace />;
  return <LandingPage />;
}
