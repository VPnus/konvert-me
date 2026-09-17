import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import type { Country } from '@/core/country';
import { currentCountry } from '@/i18n/country';

/** A section of some countries only: from any other, its address leads to the overview. */
export function CountryRoute({
  countries,
  children,
}: {
  countries: readonly Country[];
  children: ReactNode;
}) {
  return countries.includes(currentCountry()) ? children : <Navigate to="/overview" replace />;
}
